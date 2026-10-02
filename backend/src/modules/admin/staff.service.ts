import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { ALL_ROLES, type RoleCode } from "../../common/permissions";
import { str } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";
import { toStaffDto } from "./mappers";

const withRoles = { staff_role: { include: { role: true } } } as const;

/** Mật khẩu tạm 10 ký tự, dễ đọc (bỏ các ký tự dễ nhầm 0/O, 1/l/I), luôn có chữ hoa, chữ thường, số */
function tempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnpqrstuvwxyz", digit = "23456789";
  const all = upper + lower + digit;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digit), ...Array.from({ length: 7 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.staff_account.findMany({ where: { deleted_at: null }, include: withRoles, orderBy: { staff_account_id: "asc" } });
    return rows.map(toStaffDto);
  }

  private parseRoles(v: unknown): RoleCode[] {
    const roles = Array.isArray(v) ? Array.from(new Set(v.map(String))) : [];
    if (roles.length === 0) fail("ROLE_REQUIRED", "Chọn ít nhất 1 vai trò.");
    if (roles.some((r) => !ALL_ROLES.includes(r as RoleCode))) fail("VALIDATION", "Vai trò không hợp lệ.");
    return roles as RoleCode[];
  }

  private async roleIds(roles: RoleCode[]) {
    const rows = await this.prisma.role.findMany({ where: { role_code: { in: roles } } });
    if (rows.length !== roles.length) fail("ROLE_NOT_SEEDED", "CSDL chưa có đủ vai trò — hãy chạy migration_v4_backend.sql.");
    return rows.map((r) => r.role_id);
  }

  /**
   * Cấp tài khoản. Mặc định chỉ đăng nhập Google (password_hash = NULL theo
   * migration v3). Nếu cho phép mật khẩu: sinh mật khẩu tạm và trả về MỘT LẦN
   * để quản trị viên chuyển cho cán bộ (chưa có dịch vụ email).
   */
  async create(me: StaffUser, body: Record<string, unknown>) {
    const staffCode = str(body.staffCode).trim().toUpperCase();
    const fullName = str(body.fullName).trim();
    const email = str(body.email).trim().toLowerCase();
    const roles = this.parseRoles(body.roles);
    if (!/^[A-Z0-9-]{2,30}$/.test(staffCode)) fail("INVALID_CODE", "Mã cán bộ chỉ gồm chữ in hoa, số và dấu gạch ngang.");
    if (fullName.length < 3) fail("NAME_REQUIRED", "Nhập họ tên đầy đủ.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("INVALID_EMAIL", "Email không hợp lệ.");
    if (await this.prisma.staff_account.count({ where: { email } })) conflict("DUPLICATE_EMAIL", "Email đã được dùng cho tài khoản khác.");
    if (await this.prisma.staff_account.count({ where: { staff_code: staffCode } })) conflict("DUPLICATE_CODE", "Mã cán bộ đã tồn tại.");
    const ids = await this.roleIds(roles);
    const temporaryPassword = body.allowPassword === true ? tempPassword() : null;

    const staff = await this.prisma.$transaction(async (tx) => {
      const s = await tx.staff_account.create({
        data: {
          staff_code: staffCode,
          full_name: fullName,
          email,
          password_hash: temporaryPassword ? await bcrypt.hash(temporaryPassword, 10) : null,
          // Mật khẩu tạm do quản trị biết -> bắt cán bộ đổi ở lần đăng nhập đầu
          must_change_password: !!temporaryPassword,
          staff_role: { create: ids.map((role_id) => ({ role_id })) },
        },
        include: withRoles,
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "STAFF_CREATE", { table: "staff_account", id: s.staff_account_id }, `Cấp tài khoản ${staffCode} (${roles.join(", ")})`, tx);
      return s;
    });
    return { ...toStaffDto(staff), temporaryPassword };
  }

  async updateRoles(me: StaffUser, staffId: number, body: Record<string, unknown>) {
    const roles = this.parseRoles(body.roles);
    const s = await this.prisma.staff_account.findFirst({ where: { staff_account_id: BigInt(staffId), deleted_at: null }, include: withRoles });
    if (!s) notFound("Không tìm thấy tài khoản.");
    if (staffId === me.staffAccountId && !roles.includes("ADMIN")) fail("SELF_LOCKOUT", "Không thể tự gỡ vai trò Quản trị của chính mình.");
    const ids = await this.roleIds(roles);
    const before = s.staff_role.map((r) => r.role.role_code).join(", ");
    await this.prisma.$transaction(async (tx) => {
      await tx.staff_role.deleteMany({ where: { staff_account_id: s.staff_account_id, role_id: { notIn: ids } } });
      await tx.staff_role.createMany({ data: ids.map((role_id) => ({ staff_account_id: s.staff_account_id, role_id })), skipDuplicates: true });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "STAFF_ROLE_UPDATE", { table: "staff_role", id: s.staff_account_id }, `${s.staff_code}: ${before} → ${roles.join(", ")}`, tx);
    });
    return { success: true };
  }

  /**
   * Cấp lại mật khẩu tạm cho cán bộ quên mật khẩu (hoặc cho phép tài khoản chỉ-Google đăng nhập bằng mật khẩu).
   * Mật khẩu tạm trả về MỘT LẦN; cán bộ bị bắt đổi ở lần đăng nhập tới. Tự đổi của mình thì dùng "Đổi mật khẩu".
   */
  async resetPassword(me: StaffUser, staffId: number) {
    if (staffId === me.staffAccountId) fail("SELF_RESET", "Để đổi mật khẩu của chính mình, dùng chức năng “Đổi mật khẩu”.");
    const s = await this.prisma.staff_account.findFirst({ where: { staff_account_id: BigInt(staffId), deleted_at: null } });
    if (!s) notFound("Không tìm thấy tài khoản.");
    const temporaryPassword = tempPassword();
    await this.prisma.$transaction(async (tx) => {
      await tx.staff_account.update({
        where: { staff_account_id: s.staff_account_id },
        data: { password_hash: await bcrypt.hash(temporaryPassword, 10), must_change_password: true, failed_login_count: 0, locked_until: null },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "STAFF_PASSWORD_RESET", { table: "staff_account", id: s.staff_account_id }, `Cấp lại mật khẩu tạm cho ${s.staff_code}`, tx);
    });
    return { temporaryPassword };
  }

  /** Sửa thông tin hiển thị của cán bộ (họ tên). Email và mã cán bộ là định danh nên không đổi. */
  async updateInfo(me: StaffUser, staffId: number, body: Record<string, unknown>) {
    const fullName = str(body.fullName).trim().replace(/\s+/g, " ");
    if (fullName.length < 2 || fullName.length > 255) fail("NAME_REQUIRED", "Họ tên cần từ 2 đến 255 ký tự.");
    const s = await this.prisma.staff_account.findFirst({ where: { staff_account_id: BigInt(staffId), deleted_at: null }, include: withRoles });
    if (!s) notFound("Không tìm thấy tài khoản.");
    if (s.full_name === fullName) return toStaffDto(s);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.staff_account.update({ where: { staff_account_id: s.staff_account_id }, data: { full_name: fullName }, include: withRoles });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "STAFF_UPDATE", { table: "staff_account", id: s.staff_account_id }, `${s.staff_code}: đổi tên “${s.full_name}” → “${fullName}”`, tx);
      return u;
    });
    return toStaffDto(updated);
  }

  async setStatus(me: StaffUser, staffId: number, status: string) {
    if (!["ACTIVE", "LOCKED", "DISABLED"].includes(status)) fail("VALIDATION", "Trạng thái không hợp lệ.");
    if (staffId === me.staffAccountId) fail("SELF_LOCKOUT", "Không thể khóa tài khoản đang đăng nhập.");
    const s = await this.prisma.staff_account.findFirst({ where: { staff_account_id: BigInt(staffId), deleted_at: null } });
    if (!s) notFound("Không tìm thấy tài khoản.");
    await this.prisma.$transaction(async (tx) => {
      await tx.staff_account.update({ where: { staff_account_id: s.staff_account_id }, data: { status } });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        status === "ACTIVE" ? "STAFF_UNLOCK" : "STAFF_LOCK",
        { table: "staff_account", id: s.staff_account_id },
        `${status === "ACTIVE" ? "Mở khóa" : "Khóa"} tài khoản ${s.staff_code}`,
        tx,
      );
    });
    return { success: true };
  }
}
