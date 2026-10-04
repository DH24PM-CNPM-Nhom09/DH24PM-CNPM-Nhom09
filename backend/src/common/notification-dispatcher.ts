import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "./config.service";
import { MailService } from "./mail.service";

const INTERVAL_MS = 20_000;
const BATCH = 20;

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
      this.log.warn("Chưa cấu hình SMTP_USER/SMTP_PASS trong .env: mã xác thực sẽ in ra cửa sổ này, thông báo email nằm chờ trong bảng notification.");
      return;
    }
    this.log.log(`Đã bật gửi email qua ${process.env.SMTP_HOST || "smtp.gmail.com"} bằng tài khoản ${process.env.SMTP_USER}.`);
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const accounts = await this.prisma.candidate_account.findMany({
        where: {
          deleted_at: null,
          email: { not: null },
          candidate: { isNot: null },
          ...(env.devBypass() ? { otp_verification: { some: { purpose: "REGISTER", verified_at: { not: null } } } } : {}),
        },
        select: { email: true, candidate: { select: { candidate_id: true } } },
      });
      const emailOf = new Map(accounts.map((a) => [String(a.candidate!.candidate_id), a.email!]));
      if (!emailOf.size) return;
      const pending = await this.prisma.notification.findMany({
        where: { recipient_type: "CANDIDATE", channel: "EMAIL", status: "PENDING", recipient_id: { in: [...emailOf.keys()].map(BigInt) } },
        orderBy: { notification_id: "asc" },
        take: BATCH,
      });
      for (const n of pending) {
        const to = emailOf.get(String(n.recipient_id))!;
        try {
          await this.mail.sendNotice(to, n.title ?? "Thông báo từ Phòng Đào tạo Sau đại học", n.content);
          await this.prisma.notification.update({ where: { notification_id: n.notification_id }, data: { status: "SENT", sent_at: new Date() } });
        } catch {
          await this.prisma.notification.update({ where: { notification_id: n.notification_id }, data: { status: "FAILED" } });
        }
      }
    } catch (e) {
      this.log.error(`Lỗi khi gửi thông báo email: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
