import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { fail, forbidden, unauthorized } from "./errors";
import { can, type Permission, type RoleCode } from "./permissions";

// ---------------------------------------------------------------------------
// Người dùng hiện tại gắn vào request sau khi xác thực
// ---------------------------------------------------------------------------
export interface StaffUser {
  type: "STAFF";
  staffAccountId: number;
  staffCode: string;
  fullName: string;
  email: string;
  roles: RoleCode[];
}
export interface CandidateUser {
  type: "CANDIDATE";
  accountId: number;
  /** null khi thí sinh mới đăng nhập Google lần đầu, chưa khai hồ sơ cá nhân */
  candidateId: number | null;
  email: string | null;
}
export type AuthUser = StaffUser | CandidateUser;

export interface JwtPayload {
  sub: number;
  typ: "STAFF" | "CANDIDATE";
}

// ---------------------------------------------------------------------------
// Decorator khai báo yêu cầu truy cập cho từng route
// ---------------------------------------------------------------------------
const PUBLIC = "auth:public";
const PERMISSION = "auth:permission";
const CANDIDATE = "auth:candidate";

/** Không cần đăng nhập (đăng nhập, quên mật khẩu, health…) */
export const Public = () => SetMetadata(PUBLIC, true);
/** Chỉ cán bộ có quyền này mới gọi được — đúng RbacGuard trong thiết kế GĐ3 */
export const RequirePermission = (p: Permission) => SetMetadata(PERMISSION, p);
/** Chỉ tài khoản thí sinh */
export const CandidateOnly = () => SetMetadata(CANDIDATE, true);
const PENDING_PW = "auth:allowPendingPasswordChange";
/** Route vẫn gọi được khi cán bộ đang bị bắt đổi mật khẩu (xem thông tin mình, đổi mật khẩu) */
export const AllowPendingPasswordChange = () => SetMetadata(PENDING_PW, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as AuthUser);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) unauthorized("Bạn cần đăng nhập để tiếp tục.");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      unauthorized();
    }

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, targets);
    const candidateOnly = this.reflector.getAllAndOverride<boolean>(CANDIDATE, targets);

    if (payload.typ === "STAFF") {
      // Luôn đọc lại từ DB: tài khoản vừa bị khóa hoặc đổi vai trò có hiệu lực ngay
      const staff = await this.prisma.staff_account.findFirst({
        where: { staff_account_id: BigInt(payload.sub), deleted_at: null },
        include: { staff_role: { include: { role: true } } },
      });
      if (!staff) unauthorized();
      if (staff.status !== "ACTIVE") fail("ACCOUNT_LOCKED", "Tài khoản của bạn đã bị khóa. Liên hệ quản trị hệ thống.", 401);
      const user: StaffUser = {
        type: "STAFF",
        staffAccountId: Number(staff.staff_account_id),
        staffCode: staff.staff_code,
        fullName: staff.full_name,
        email: staff.email,
        roles: staff.staff_role.map((r) => r.role.role_code as RoleCode),
      };
      if (candidateOnly) forbidden("Chức năng này chỉ dành cho thí sinh.");
      // Đang dùng mật khẩu tạm: chặn mọi thao tác cho tới khi đổi mật khẩu
      if (staff.must_change_password && !this.reflector.getAllAndOverride<boolean>(PENDING_PW, targets))
        fail("PASSWORD_CHANGE_REQUIRED", "Bạn cần đổi mật khẩu tạm trước khi sử dụng hệ thống.", 403);
      if (permission && !can(user.roles, permission)) forbidden();
      req.user = user;
      return true;
    }

    if (payload.typ === "CANDIDATE") {
      if (permission) forbidden("Chức năng này chỉ dành cho cán bộ.");
      const account = await this.prisma.candidate_account.findFirst({
        where: { account_id: BigInt(payload.sub), deleted_at: null },
        include: { candidate: true },
      });
      if (!account) unauthorized();
      if (account.status === "LOCKED") fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa.", 401);
      req.user = {
        type: "CANDIDATE",
        accountId: Number(account.account_id),
        candidateId: account.candidate ? Number(account.candidate.candidate_id) : null,
        email: account.email,
      };
      return true;
    }
    unauthorized();
  }
}

export function asStaff(user: AuthUser): StaffUser {
  if (user.type !== "STAFF") forbidden("Chức năng này chỉ dành cho cán bộ.");
  return user;
}
export function asCandidate(user: AuthUser): CandidateUser {
  if (user.type !== "CANDIDATE") forbidden("Chức năng này chỉ dành cho thí sinh.");
  return user;
}
