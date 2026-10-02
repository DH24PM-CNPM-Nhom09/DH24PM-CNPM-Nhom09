import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { AuditService } from "../../common/audit.service";
import { env, SystemConfigService } from "../../common/config.service";
import { AppError, conflict, fail } from "../../common/errors";
import { MailService } from "../../common/mail.service";
import { OtpService } from "../../common/otp.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toStaffDto } from "../admin/mappers";

const DEMO_CANDIDATE_EMAIL = "thisinh.demo@gmail.com";

@Injectable()
export class AuthService {
  private google = new OAuth2Client();
  private readonly logger = new Logger("Auth");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
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
    if (account.status === "PENDING_VERIFY")
      // detail = email để frontend chuyển sang bước nhập mã (người dùng đã nhập đúng mật khẩu)
      throw new AppError("ACCOUNT_NOT_VERIFIED", `Tài khoản chưa xác thực email. Nhập mã đã gửi tới ${maskEmail(account.email)} để kích hoạt.`, HttpStatus.FORBIDDEN, account.email ?? undefined);
    return { accessToken: await this.candidateToken(account.account_id) };
  }

  // ======================================================================== Đăng ký (UC-TS-01)
  /**
   * Bước 1: thí sinh tự khai họ tên, ngày sinh, email, số điện thoại, mật khẩu.
   * Tạo tài khoản ở trạng thái PENDING_VERIFY kèm hồ sơ cá nhân (bảng candidate),
   * rồi gửi mã 6 số về email. Đăng ký lại bằng email chưa xác thực thì cập nhật thông tin và gửi mã mới.
   */
  async register(body: Record<string, unknown>) {
    const fullName = String(body.fullName ?? "").trim().replace(/\s+/g, " ");
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phoneNumber ?? "").replace(/[\s.-]/g, "");
    const password = String(body.password ?? "");
    const dobRaw = String(body.dob ?? "");
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? new Date(dobRaw + "T00:00:00Z") : new Date(NaN);

    if (fullName.length < 4 || !/^[\p{L} ]+$/u.test(fullName)) fail("VALIDATION", "Họ và tên chỉ gồm chữ cái và khoảng trắng, ví dụ: Nguyễn Văn An.");
    if (Number.isNaN(dob.getTime())) fail("VALIDATION", "Ngày sinh không hợp lệ.");
    const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
    if (age < 18 || age > 80) fail("VALIDATION", "Ngày sinh không hợp lệ: thí sinh phải từ 18 tuổi trở lên.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) fail("VALIDATION", "Email không hợp lệ.");
    if (!/^0\d{9}$/.test(phone)) fail("VALIDATION", "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      fail("WEAK_PASSWORD", "Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.");

    const existing = await this.prisma.candidate_account.findFirst({ where: { email }, include: { candidate: true } });
    if (existing && (existing.status !== "PENDING_VERIFY" || existing.deleted_at))
      conflict("EMAIL_EXISTS", "Email này đã có tài khoản. Hãy đăng nhập, hoặc chọn “Quên mật khẩu” nếu không nhớ mật khẩu.");
    const phoneOwner = await this.prisma.candidate_account.findFirst({ where: { phone_number: phone } });
    if (phoneOwner && phoneOwner.account_id !== existing?.account_id)
      conflict("DUPLICATE_PHONE", "Số điện thoại này đã được dùng cho tài khoản khác.");

    const passwordHash = await bcrypt.hash(password, 10);
    const accountId = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.candidate_account.update({ where: { account_id: existing.account_id }, data: { phone_number: phone, password_hash: passwordHash } });
        if (existing.candidate)
          await tx.candidate.update({ where: { candidate_id: existing.candidate.candidate_id }, data: { full_name: fullName, dob } });
        else await tx.candidate.create({ data: { account_id: existing.account_id, full_name: fullName, dob, nationality: "Việt Nam" } });
        return existing.account_id;
      }
      const acc = await tx.candidate_account.create({
        data: { username: email, email, phone_number: phone, password_hash: passwordHash, status: "PENDING_VERIFY" },
      });
      await tx.candidate.create({ data: { account_id: acc.account_id, full_name: fullName, dob, nationality: "Việt Nam" } });
      return acc.account_id;
    });
    return this.sendRegisterOtp(accountId, email);
  }

  /** Gửi lại mã xác thực đăng ký */
  async resendRegister(emailRaw: string) {
    const email = (emailRaw ?? "").trim().toLowerCase();
    const account = await this.prisma.candidate_account.findFirst({ where: { email, deleted_at: null } });
    if (!account) fail("NOT_FOUND", "Không tìm thấy đăng ký nào với email này. Vui lòng đăng ký lại.", HttpStatus.NOT_FOUND);
    if (account.status !== "PENDING_VERIFY") fail("ALREADY_VERIFIED", "Tài khoản đã được xác thực. Bạn có thể đăng nhập.");
    return this.sendRegisterOtp(account.account_id, email);
  }

  private async sendRegisterOtp(accountId: bigint, email: string) {
    const { otp, minutes, resendAfterSeconds } = await this.otp.issue(accountId, "REGISTER");
    const emailSent = await this.deliverOtp(email, otp, "REGISTER", minutes);
    return {
      email,
      emailSent,
      expiresInMinutes: minutes,
      resendAfterSeconds,
      // Chỉ khi CHƯA cấu hình SMTP và đang ở chế độ phát triển: trả mã để thử được
      ...(!emailSent && env.devBypass() ? { devOtp: otp } : {}),
    };
  }

  /** Bước 2: nhập mã đúng -> kích hoạt tài khoản và đăng nhập luôn */
  async verifyRegister(emailRaw: string, code: string) {
    const email = (emailRaw ?? "").trim().toLowerCase();
    const account = await this.prisma.candidate_account.findFirst({ where: { email, deleted_at: null }, include: { candidate: true } });
    if (!account) fail("NOT_FOUND", "Không tìm thấy đăng ký nào với email này.", HttpStatus.NOT_FOUND);
    if (account.status !== "PENDING_VERIFY") fail("ALREADY_VERIFIED", "Tài khoản đã được xác thực. Bạn có thể đăng nhập.");
    const otpId = await this.otp.check(account.account_id, "REGISTER", String(code ?? "").trim());
    await this.prisma.$transaction(async (tx) => {
      await tx.otp_verification.update({ where: { otp_id: otpId }, data: { verified_at: new Date() } });
      await tx.candidate_account.update({ where: { account_id: account.account_id }, data: { status: "ACTIVE", failed_login_count: 0, locked_until: null } });
      if (account.candidate)
        await this.audit.record(
          { type: "CANDIDATE", id: Number(account.candidate.candidate_id) },
          "CANDIDATE_REGISTER",
          { table: "candidate_account", id: account.account_id },
          `Đăng ký tài khoản và xác thực email ${email}`,
          tx,
        );
    });
    return { accessToken: await this.candidateToken(account.account_id) };
  }

  // ======================================================================== Quên mật khẩu (UC-CC-02)
  /**
   * Email của tài khoản đã được xác thực chưa: tự đăng ký và nhập đúng mã, hoặc
   * đăng nhập bằng Google thật (khi tắt DEV_AUTH_BYPASS). Tài khoản dữ liệu mẫu
   * dùng địa chỉ bịa nên KHÔNG BAO GIỜ được gửi email thật.
   */
  async emailVerified(accountId: bigint) {
    if (!env.devBypass()) return true;
    return (await this.prisma.otp_verification.count({ where: { account_id: accountId, purpose: "REGISTER", verified_at: { not: null } } })) > 0;
  }

  /** Luôn trả lời giống nhau để không lộ tài khoản có tồn tại hay không */
  async forgotPassword(emailOrPhone: string) {
    if (!emailOrPhone?.trim()) fail("VALIDATION", "Nhập email hoặc số điện thoại đã đăng ký.");
    const account = await this.findCandidateAccount(emailOrPhone);
    const generic = { sent: true, resendAfterSeconds: await this.otp.resendSeconds() };
    if (!account || !account.email) return generic;
    if (this.mail.configured && !(await this.emailVerified(account.account_id))) {
      this.logger.warn(`Bỏ qua gửi mã đặt lại mật khẩu tới ${account.email}: email chưa được xác thực (tài khoản dữ liệu mẫu).`);
      return generic;
    }
    const { otp, minutes } = await this.otp.issue(account.account_id, "RESET_PASSWORD");
    const emailSent = await this.deliverOtp(account.email, otp, "RESET_PASSWORD", minutes);
    return { ...generic, ...(!emailSent && env.devBypass() ? { devOtp: otp } : {}) };
  }

  async resetPassword(emailOrPhone: string, otp: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))
      fail("WEAK_PASSWORD", "Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.");
    const account = await this.findCandidateAccount(emailOrPhone);
    if (!account) fail("OTP_INVALID", "Mã xác thực không đúng hoặc đã hết hạn.");
    const otpId = await this.otp.check(account.account_id, "RESET_PASSWORD", String(otp ?? "").trim());
    await this.prisma.$transaction([
      this.prisma.otp_verification.update({ where: { otp_id: otpId }, data: { verified_at: new Date() } }),
      this.prisma.candidate_account.update({
        where: { account_id: account.account_id },
        // Nhập đúng mã gửi qua email cũng chứng minh sở hữu email -> kích hoạt nếu đang chờ xác thực
        data: { password_hash: await bcrypt.hash(newPassword, 10), failed_login_count: 0, locked_until: null, status: "ACTIVE" },
      }),
    ]);
    return { success: true };
  }

  /** Gửi mã qua email; trả false nếu chưa cấu hình SMTP (mã được in ra cửa sổ backend) */
  private async deliverOtp(email: string, otp: string, purpose: "REGISTER" | "RESET_PASSWORD", minutes: number) {
    try {
      return await this.mail.sendOtp(email, otp, purpose, minutes);
    } catch {
      fail("MAIL_FAILED", "Không gửi được email xác thực lúc này. Vui lòng thử lại sau ít phút.", HttpStatus.BAD_GATEWAY);
    }
  }
}

function maskEmail(email: string | null) {
  if (!email) return "email đã đăng ký";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
