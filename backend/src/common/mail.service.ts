import { Global, Injectable, Logger, Module } from "@nestjs/common";
import * as nodemailer from "nodemailer";

/**
 * Gửi email qua SMTP (mặc định Gmail + Mật khẩu ứng dụng).
 *
 * Cấu hình trong .env:
 *   SMTP_USER="tenban@gmail.com"
 *   SMTP_PASS="abcd efgh ijkl mnop"   (Mật khẩu ứng dụng 16 ký tự của Google, KHÔNG phải mật khẩu Gmail)
 *   SMTP_HOST / SMTP_PORT / MAIL_FROM_NAME (tùy chọn)
 *
 * Chưa cấu hình SMTP: không gửi, chỉ in nội dung ra cửa sổ backend để vẫn thử được.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger("Mail");
  private transporter: nodemailer.Transporter | null = null;

  get configured(): boolean {
    return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
  }

  private transport(): nodemailer.Transporter {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT || 465);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS!.replace(/\s/g, "") },
      });
    }
    return this.transporter;
  }

  /** Trả về true nếu đã gửi qua SMTP; false nếu chỉ in ra console (chưa cấu hình) */
  async send(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.configured) {
      this.log.warn(`[CHƯA CẤU HÌNH SMTP] Email tới ${to} — ${subject}\n${text}`);
      return false;
    }
    const fromName = process.env.MAIL_FROM_NAME || "Tuyển sinh Sau đại học - ĐH An Giang";
    try {
      await this.transport().sendMail({ from: `"${fromName}" <${process.env.SMTP_USER!.trim()}>`, to, subject, text, html });
      this.log.log(`Đã gửi email tới ${to}: ${subject}`);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Gửi email tới ${to} thất bại: ${msg}`);
      if (/Invalid login|BadCredentials|535/i.test(msg))
        this.log.error("Kiểm tra SMTP_USER và SMTP_PASS: SMTP_PASS phải là Mật khẩu ứng dụng 16 ký tự của Google, không phải mật khẩu Gmail.");
      throw e;
    }
  }

  /** Email mã xác thực */
  async sendOtp(to: string, otp: string, purpose: "REGISTER" | "RESET_PASSWORD", minutes: number): Promise<boolean> {
    const what = purpose === "REGISTER" ? "xác thực đăng ký tài khoản" : "đặt lại mật khẩu";
    const subject = `Mã ${what}: ${otp}`;
    const text =
      `Mã ${what} của bạn là: ${otp}\n` +
      `Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai, kể cả cán bộ nhà trường.\n\n` +
      `Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.\n` +
      `Phòng Đào tạo Sau đại học - Trường Đại học An Giang`;
    const html = layout(
      `<p style="margin:0 0 12px">Mã ${what} của bạn là:</p>
       <p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:8px;color:#142B4D">${otp}</p>
       <p style="margin:0 0 8px;color:#4b5563">Mã có hiệu lực trong <b>${minutes} phút</b>. Không chia sẻ mã này cho bất kỳ ai, kể cả cán bộ nhà trường.</p>
       <p style="margin:0;color:#9ca3af;font-size:13px">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>`,
    );
    return this.send(to, subject, text, html);
  }

  /** Email thông báo xử lý hồ sơ */
  async sendNotice(to: string, title: string, content: string): Promise<boolean> {
    const html = layout(`<p style="margin:0 0 8px;font-weight:700;font-size:16px;color:#142B4D">${esc(title)}</p>
      <p style="margin:0;color:#374151;white-space:pre-line">${esc(content)}</p>`);
    return this.send(to, title, `${title}\n\n${content}\n\nPhòng Đào tạo Sau đại học - Trường Đại học An Giang`, html);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function layout(body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#142B4D;color:#fff;padding:16px 24px;font-weight:700">Tuyển sinh Sau đại học · Trường ĐH An Giang</div>
    <div style="padding:24px;font-size:15px;line-height:1.5;color:#111827">${body}</div>
  </div></div>`;
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
