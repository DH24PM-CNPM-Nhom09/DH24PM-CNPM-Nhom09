import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "./config.service";
import { bumpCounter, clearCounter } from "./counter";
import { MailService } from "./mail.service";

const INTERVAL_MS = 20_000;
const BATCH = 20;
/** Số lần gửi tối đa trước khi đánh FAILED, và thời gian chờ giữa các lần thử lại (phút) */
const MAX_ATTEMPTS = 6;
const RETRY_MINUTES = [1, 5, 15, 60, 180];

/**
 * Gửi các thông báo kênh EMAIL đang chờ (status PENDING) trong bảng notification.
 * AuditService.notifyCandidate chỉ ghi hàng đợi bên trong transaction nghiệp vụ;
 * việc gửi thật diễn ra ở đây, sau khi dữ liệu đã lưu, nên lỗi mạng không làm hỏng thao tác duyệt hồ sơ.
 *
 * An toàn với dữ liệu mẫu: chỉ gửi tới thí sinh đã xác thực email (tự đăng ký và nhập đúng mã).
 * Các địa chỉ bịa trong dữ liệu demo không bao giờ nhận email.
 */
@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("NotificationDispatcher");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    if (!this.mail.configured) {
      this.log.warn("Chưa cấu hình gửi email (RESEND_API_KEY hoặc SMTP_USER/SMTP_PASS trong .env): mã xác thực sẽ in ra cửa sổ này, thông báo email nằm chờ trong bảng notification.");
      return;
    }
    this.log.log(`Đã bật gửi email qua ${this.mail.describe()}.`);
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Chỉ lấy đúng BATCH thông báo đang chờ của thí sinh đủ điều kiện nhận email (JOIN trong CSDL),
      // không còn tải toàn bộ tài khoản thí sinh mỗi 20 giây. Thông báo đang chờ thử lại (mailwait:<id>) thì bỏ qua.
      const pending = await this.prisma.$queryRawUnsafe<{ notification_id: bigint; title: string | null; content: string; email: string }[]>(
        `SELECT n.notification_id, n.title, n.content, a.email
           FROM notification n
           JOIN candidate c ON c.candidate_id = n.recipient_id
           JOIN candidate_account a ON a.account_id = c.account_id AND a.deleted_at IS NULL AND a.email IS NOT NULL
           LEFT JOIN security_counter w ON w.counter_key = CONCAT('mailwait:', n.notification_id)
          WHERE n.status = 'PENDING' AND n.channel = 'EMAIL' AND n.recipient_type = 'CANDIDATE'
            AND (w.counter_key IS NULL OR w.reset_at <= UTC_TIMESTAMP())
            ${env.verifiedEmailOnly() ? "AND EXISTS (SELECT 1 FROM otp_verification o WHERE o.account_id = a.account_id AND o.purpose = 'REGISTER' AND o.verified_at IS NOT NULL)" : ""}
          ORDER BY n.notification_id
          LIMIT ${BATCH}`,
      );
      for (const n of pending) {
        try {
          const ok = await this.mail.sendNotice(n.email, n.title ?? "Thông báo từ Phòng Đào tạo Sau đại học", n.content);
          if (!ok) throw new Error("Máy chủ email không nhận thư");
          await this.prisma.notification.update({ where: { notification_id: n.notification_id }, data: { status: "SENT", sent_at: new Date() } });
          await clearCounter(this.prisma, `mail:${n.notification_id}`);
          await clearCounter(this.prisma, `mailwait:${n.notification_id}`);
        } catch (e) {
          await this.retryLater(n.notification_id, e);
        }
      }
    } catch (e) {
      this.log.error(`Lỗi khi gửi thông báo email: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Gửi lỗi (mạng chập chờn, nhà cung cấp email tạm từ chối…): giữ PENDING và thử lại sau 1, 5, 15, 60, 180 phút.
   * Lỗi quá MAX_ATTEMPTS lần mới đánh FAILED. Số lần thử lưu trong bảng security_counter nên không mất khi máy chủ ngủ.
   */
  private async retryLater(notificationId: bigint, e: unknown) {
    const { hits } = await bumpCounter(this.prisma, `mail:${notificationId}`, 7 * 86_400_000);
    if (hits >= MAX_ATTEMPTS) {
      await this.prisma.notification.update({ where: { notification_id: notificationId }, data: { status: "FAILED" } });
      await clearCounter(this.prisma, `mail:${notificationId}`);
      await clearCounter(this.prisma, `mailwait:${notificationId}`);
      this.log.warn(`Thông báo #${notificationId}: gửi email lỗi ${hits} lần, dừng thử (${e instanceof Error ? e.message : String(e)}).`);
      return;
    }
    const waitMin = RETRY_MINUTES[Math.min(hits - 1, RETRY_MINUTES.length - 1)];
    await clearCounter(this.prisma, `mailwait:${notificationId}`);
    await bumpCounter(this.prisma, `mailwait:${notificationId}`, waitMin * 60_000);
  }
}
