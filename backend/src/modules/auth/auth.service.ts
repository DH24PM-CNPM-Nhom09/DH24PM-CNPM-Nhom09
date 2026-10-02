import { HttpStatus, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { AuditService } from "../../common/audit.service";
import { env, SystemConfigService } from "../../common/config.service";
import { fail } from "../../common/errors";
import { PrismaService } from "../../prisma/prisma.service";
import { toStaffDto } from "../admin/mappers";

const DEMO_CANDIDATE_EMAIL = "thisinh.demo@gmail.com";

@Injectable()
export class AuthService {
  private google = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
  ) {}

  /**
   * Xác minh Google ID token, trả về email đã được Google xác thực.
   * DEV_AUTH_BYPASS=true: chấp nhận "dev:<email>", một email trần, hoặc
   * "mock-google-id-token" (token giả frontend thí sinh đang gửi) để demo khi
   * chưa cấu hình Google Client ID.
   */
  private async googleEmail(idToken: string, fallbackDevEmail?: string): Promise<{ email: string; name: string | null }> {
    const token = (idToken ?? "").trim();
    if (!token) fail("INVALID_TOKEN", "Thiếu Google ID token.");
    if (env.devBypass()) {
      if (token.startsWith("dev:")) return { email: token.slice(4).toLowerCase(), name: null };
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) return { email: token.toLowerCase(), name: null };
      if (token === "mock-google-id-token" && fallbackDevEmail) return { email: fallbackDevEmail, name: null };
    }
    if (!env.googleClientId()) fail("GOOGLE_NOT_CONFIGURED", "Máy chủ chưa cấu hình GOOGLE_CLIENT_ID để đăng nhập bằng Google.", HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const ticket = await this.google.verifyIdToken({ idToken: token, audience: env.googleClientId() });
      const p = ticket.getPayload();
      if (!p?.email || !p.email_verified) fail("GOOGLE_EMAIL_UNVERIFIED", "Email Google chưa được xác thực.");
      return { email: p.email.toLowerCase(), name: p.name ?? null };
    } catch (e) {
      if (e && typeof e === "object" && "errorCode" in e) throw e;
      fail("INVALID_TOKEN", "Google ID token không hợp lệ hoặc đã hết hạn.", HttpStatus.UNAUTHORIZED);
    }
  }

  // ======================================================================== Cán bộ
  private async staffSession(staffId: bigint, method: string) {
    const staff = await this.prisma.staff_account.findUniqueOrThrow({
      where: { staff_account_id: staffId },
      include: { staff_role: { include: { role: true } } },
    });
    await this.audit.record({ type: "STAFF", id: Number(staffId) }, "STAFF_LOGIN", { table: "staff_account", id: staffId }, `Đăng nhập bằng ${method}`);
    const accessToken = await this.jwt.signAsync({ sub: Number(staffId), typ: "STAFF" });
    return { accessToken, staff: toStaffDto(staff) };
  }

  async staffLogin(email: string, password: string) {
    if (!email?.trim() || !password) fail("VALIDATION", "Nhập email công tác và mật khẩu.");
    const staff = await this.prisma.staff_account.findFirst({ where: { email: email.trim().toLowerCase(), deleted_at: null } });
    if (!staff) fail("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", HttpStatus.UNAUTHORIZED);
    if (staff.status !== "ACTIVE") fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa. Liên hệ quản trị hệ thống để mở khóa.", HttpStatus.FORBIDDEN);
    if (!staff.password_hash)
      fail("ERR_PASSWORD_LOGIN_DISABLED", "Tài khoản này chỉ đăng nhập bằng Google. Chọn “Đăng nhập với Google”.", HttpStatus.FORBIDDEN);
    if (!(await bcrypt.compare(password, staff.password_hash))) fail("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", HttpStatus.UNAUTHORIZED);
    return this.staffSession(staff.staff_account_id, "mật khẩu");
  }

  async staffGoogle(idToken: string) {
    const { email } = await this.googleEmail(idToken);
    const staff = await this.prisma.staff_account.findFirst({ where: { email, deleted_at: null } });
    if (!staff) fail("STAFF_NOT_FOUND", "Tài khoản Google này chưa được cấp quyền cán bộ.", HttpStatus.FORBIDDEN);
    if (staff.status !== "ACTIVE") fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa. Liên hệ quản trị hệ thống để mở khóa.", HttpStatus.FORBIDDEN);
    return this.staffSession(staff.staff_account_id, "Google");
  }

  async staffMe(staffId: number) {
    const staff = await this.prisma.staff_account.findUniqueOrThrow({
      where: { staff_account_id: BigInt(staffId) },
      include: { staff_role: { include: { role: true } } },
    });
    return toStaffDto(staff);
  }

  // ======================================================================== Thí sinh
  private candidateToken(accountId: bigint) {
    return this.jwt.signAsync({ sub: Number(accountId), typ: "CANDIDATE" });
  }

  async candidateGoogle(idToken: string) {
    const { email } = await this.googleEmail(idToken, DEMO_CANDIDATE_EMAIL);
    let account = await this.prisma.candidate_account.findFirst({ where: { email, deleted_at: null } });
    if (!account) {
      // Lần đầu đăng nhập Google: tạo tài khoản; hồ sơ cá nhân (bảng candidate) khai sau
      account = await this.prisma.candidate_account.create({ data: { username: email, email, status: "ACTIVE" } });
    } else if (account.status === "LOCKED" && (!account.locked_until || account.locked_until > new Date())) {
      fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.", HttpStatus.FORBIDDEN);
    } else if (account.status !== "ACTIVE") {
      account = await this.prisma.candidate_account.update({ where: { account_id: account.account_id }, data: { status: "ACTIVE" } });
    }
    return { accessToken: await this.candidateToken(account.account_id) };
  }

  private findCandidateAccount(emailOrPhone: string) {
    const v = (emailOrPhone ?? "").trim().toLowerCase();
    return this.prisma.candidate_account.findFirst({
      where: { deleted_at: null, OR: [{ email: v }, { phone_number: v }, { username: v }] },
    });
  }

  /** Đăng nhập bằng mật khẩu (phương án dự phòng theo migration v3), có khóa tạm khi sai nhiều lần */
  async candidateLogin(emailOrPhone: string, password: string) {
    if (!emailOrPhone?.trim() || !password) fail("VALIDATION", "Nhập email/số điện thoại và mật khẩu.");
    const account = await this.findCandidateAccount(emailOrPhone);
    const wrong: () => never = () => fail("INVALID_CREDENTIALS", "Thông tin đăng nhập không đúng.", HttpStatus.UNAUTHORIZED);
    if (!account) wrong();
    if (account.locked_until && account.locked_until > new Date())
      fail("ACCOUNT_LOCKED", `Tài khoản bị khóa tạm đến ${account.locked_until.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} do đăng nhập sai nhiều lần.`, HttpStatus.FORBIDDEN);
    if (!account.password_hash) fail("ERR_PASSWORD_LOGIN_DISABLED", "Tài khoản này chỉ đăng nhập bằng Google.", HttpStatus.FORBIDDEN);
    if (!(await bcrypt.compare(password, account.password_hash))) {
      const max = await this.config.int("LOGIN_MAX_FAILED", 5);
      const lockMin = await this.config.int("LOGIN_LOCK_MINUTES", 15);
      const count = account.failed_login_count + 1;
      await this.prisma.candidate_account.update({
        where: { account_id: account.account_id },
        data: count >= max ? { failed_login_count: 0, locked_until: new Date(Date.now() + lockMin * 60_000) } : { failed_login_count: count },
      });
      wrong();
    }
    await this.prisma.candidate_account.update({ where: { account_id: account.account_id }, data: { failed_login_count: 0, locked_until: null } });
    return { accessToken: await this.candidateToken(account.account_id) };
  }

  /** UC-CC-02: gửi OTP đặt lại mật khẩu. Luôn trả lời giống nhau để không lộ tài khoản có tồn tại hay không. */
  async forgotPassword(emailOrPhone: string) {
    if (!emailOrPhone?.trim()) fail("VALIDATION", "Nhập email hoặc số điện thoại đã đăng ký.");
    const account = await this.findCandidateAccount(emailOrPhone);
    if (!account) return { sent: true };
    const now = new Date();
    const previous = await this.prisma.otp_verification.findFirst({
      where: { account_id: account.account_id, purpose: "RESET_PASSWORD", verified_at: null },
      orderBy: { otp_id: "desc" },
    });
    const maxResend = await this.config.int("OTP_MAX_RESEND", 5);
    const sentCount = previous && previous.expires_at.getTime() > now.getTime() - 3_600_000 ? previous.sent_count + 1 : 1;
    if (sentCount > maxResend) fail("OTP_TOO_MANY", "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.", HttpStatus.TOO_MANY_REQUESTS);
    // Mỗi mục đích chỉ 1 OTP còn hiệu lực: vô hiệu mã cũ trước khi tạo mã mới
    await this.prisma.otp_verification.updateMany({
      where: { account_id: account.account_id, purpose: "RESET_PASSWORD", verified_at: null, expires_at: { gt: now } },
      data: { expires_at: now },
    });
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const minutes = await this.config.int("OTP_EXPIRE_MINUTES", 5);
    await this.prisma.otp_verification.create({
      data: {
        account_id: account.account_id,
        purpose: "RESET_PASSWORD",
        otp_code_hash: await bcrypt.hash(otp, 10),
        sent_count: sentCount,
        expires_at: new Date(now.getTime() + minutes * 60_000),
      },
    });
    // TODO khi có dịch vụ email/SMS: gửi otp qua kênh tương ứng. Hiện ghi vào hàng đợi thông báo.
    return env.devBypass() ? { sent: true, devOtp: otp } : { sent: true };
  }

  async resetPassword(emailOrPhone: string, otp: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) fail("WEAK_PASSWORD", "Mật khẩu mới cần ít nhất 8 ký tự.");
    const account = await this.findCandidateAccount(emailOrPhone);
    const invalid: () => never = () => fail("OTP_INVALID", "Mã OTP không đúng hoặc đã hết hạn.");
    if (!account) invalid();
    const row = await this.prisma.otp_verification.findFirst({
      where: { account_id: account.account_id, purpose: "RESET_PASSWORD", verified_at: null, expires_at: { gt: new Date() } },
      orderBy: { otp_id: "desc" },
    });
    if (!row || !(await bcrypt.compare(String(otp ?? ""), row.otp_code_hash))) invalid();
    await this.prisma.$transaction([
      this.prisma.otp_verification.update({ where: { otp_id: row.otp_id }, data: { verified_at: new Date() } }),
      this.prisma.candidate_account.update({
        where: { account_id: account.account_id },
        data: { password_hash: await bcrypt.hash(newPassword, 10), failed_login_count: 0, locked_until: null, status: "ACTIVE" },
      }),
    ]);
    return { success: true };
  }
}
