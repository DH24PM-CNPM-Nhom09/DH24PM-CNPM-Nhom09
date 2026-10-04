import { Global, HttpStatus, Injectable, Module } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "./config.service";
import { fail } from "./errors";

export type OtpPurpose = "REGISTER" | "RESET_PASSWORD";

/** Số lần nhập sai tối đa cho mỗi mã; quá số này mã bị hủy, phải yêu cầu mã mới */
const MAX_WRONG_ATTEMPTS = 5;

/**
 * UC-CC-02 — OTP dùng chung cho đăng ký và quên mật khẩu (bảng otp_verification).
 * - Mã 6 số, chỉ lưu bản băm bcrypt.
 * - Mỗi mục đích chỉ có 1 mã còn hiệu lực; tạo mã mới thì mã cũ hết hạn ngay.
 * - Chờ OTP_RESEND_SECONDS giây giữa 2 lần gửi, tối đa OTP_MAX_RESEND lần mỗi giờ.
 * - Nhập sai 5 lần thì mã bị hủy (đếm trong bộ nhớ của tiến trình backend).
 */
@Injectable()
export class OtpService {
  private wrongAttempts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
  ) {}

  expireMinutes() {
    return this.config.int("OTP_EXPIRE_MINUTES", 5);
  }

  resendSeconds() {
    return this.config.int("OTP_RESEND_SECONDS", 60);
  }

  /** Tạo mã mới, trả về mã gốc (để gửi email) và thời hạn */
  async issue(accountId: bigint, purpose: OtpPurpose): Promise<{ otp: string; minutes: number; resendAfterSeconds: number }> {
    const now = new Date();
    const minutes = await this.expireMinutes();
    const resendAfter = await this.resendSeconds();
    const previous = await this.prisma.otp_verification.findFirst({
      where: { account_id: accountId, purpose, verified_at: null },
      orderBy: { otp_id: "desc" },
    });
    if (previous) {
      // Thời điểm gửi = hạn - thời gian hiệu lực (bảng không có cột created_at)
      const sentAt = previous.expires_at.getTime() - minutes * 60_000;
      const wait = Math.ceil((sentAt + resendAfter * 1000 - now.getTime()) / 1000);
      if (wait > 0 && previous.expires_at > now)
        fail("OTP_RESEND_TOO_SOON", `Vui lòng đợi ${wait} giây nữa rồi bấm gửi lại mã.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const maxResend = await this.config.int("OTP_MAX_RESEND", 5);
    const sentCount = previous && previous.expires_at.getTime() > now.getTime() - 3_600_000 ? previous.sent_count + 1 : 1;
    if (sentCount > maxResend) fail("OTP_TOO_MANY", "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.", HttpStatus.TOO_MANY_REQUESTS);

    await this.prisma.otp_verification.updateMany({
      where: { account_id: accountId, purpose, verified_at: null, expires_at: { gt: now } },
      data: { expires_at: now },
    });
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const row = await this.prisma.otp_verification.create({
      data: {
        account_id: accountId,
        purpose,
        otp_code_hash: await bcrypt.hash(otp, 10),
        sent_count: sentCount,
        expires_at: new Date(now.getTime() + minutes * 60_000),
      },
    });
    this.wrongAttempts.delete(String(row.otp_id));
    return { otp, minutes, resendAfterSeconds: resendAfter };
  }

  /**
   * Kiểm tra mã. Đúng: trả về otp_id (chưa đánh dấu đã dùng — người gọi đánh dấu
   * trong cùng transaction với thao tác chính). Sai: ném lỗi.
   */
  async check(accountId: bigint, purpose: OtpPurpose, code: string): Promise<bigint> {
    const row = await this.prisma.otp_verification.findFirst({
      where: { account_id: accountId, purpose, verified_at: null, expires_at: { gt: new Date() } },
      orderBy: { otp_id: "desc" },
    });
    if (!row) fail("OTP_EXPIRED", "Mã xác thực đã hết hạn hoặc chưa được gửi. Bấm “Gửi lại mã” để nhận mã mới.");
    const key = String(row.otp_id);
    const ok = /^\d{6}$/.test(code) && (await bcrypt.compare(code, row.otp_code_hash));
    if (!ok) {
      const n = (this.wrongAttempts.get(key) ?? 0) + 1;
      if (n >= MAX_WRONG_ATTEMPTS) {
        this.wrongAttempts.delete(key);
        await this.prisma.otp_verification.update({ where: { otp_id: row.otp_id }, data: { expires_at: new Date() } });
        fail("OTP_LOCKED", "Bạn đã nhập sai quá 5 lần. Mã này đã bị hủy, vui lòng bấm “Gửi lại mã”.");
      }
      this.wrongAttempts.set(key, n);
      fail("OTP_INVALID", `Mã xác thực không đúng. Bạn còn ${MAX_WRONG_ATTEMPTS - n} lần thử.`);
    }
    this.wrongAttempts.delete(key);
    return row.otp_id;
  }
}

@Global()
@Module({ providers: [OtpService], exports: [OtpService] })
export class OtpModule {}
