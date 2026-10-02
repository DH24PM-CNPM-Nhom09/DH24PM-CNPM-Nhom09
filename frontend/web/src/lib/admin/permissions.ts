// ============================================================================
// Ma trận phân quyền (RBAC) — đúng cách Backend GĐ3 đã chốt: KHÔNG có bảng
// permission trong DB, quyền chi tiết khai báo bằng code theo role_code và
// enforce bằng RbacGuard (@RequirePermission(...)) ở NestJS.
//
// Frontend dùng CHÍNH ma trận này để ẩn/hiện menu và nút bấm. Backend phải
// copy y hệt sang PERMISSION_MATRIX — FE chỉ là lớp hiển thị, quyết định cuối
// cùng luôn do Backend kiểm tra lại.
// ============================================================================
import type { RoleCode } from "./types";

export type Permission =
  | "dashboard:view"
  | "application:view"
  | "application:review" // tiếp nhận, kiểm minh chứng, duyệt / từ chối / yêu cầu bổ sung
  | "batch:view"
  | "batch:manage" // tạo đợt, gắn ngành, chỉ tiêu, môn thi, đổi trạng thái đợt
  | "batch:approve" // lãnh đạo phê duyệt chỉ tiêu & cấu hình ngành
  | "appeal:view"
  | "appeal:resolve"
  | "account:manage"
  | "audit:view";

export const PERMISSION_MATRIX: Record<RoleCode, Permission[]> = {
  CAN_BO_TUYEN_SINH: [
    "dashboard:view",
    "application:view",
    "application:review",
    "batch:view",
    "batch:manage",
    "appeal:view",
    "appeal:resolve",
    "audit:view",
  ],
  HOI_DONG: ["dashboard:view", "application:view", "batch:view", "appeal:view", "appeal:resolve"],
  LANH_DAO_KHOA: ["dashboard:view", "application:view", "batch:view", "batch:approve", "appeal:view", "audit:view"],
  // Admin là quản trị KỸ THUẬT: cấp tài khoản, phân quyền, xem nhật ký — không
  // tham gia thẩm định hồ sơ (tách bạch trách nhiệm theo tài liệu Vai trò người dùng).
  ADMIN: ["dashboard:view", "batch:view", "account:manage", "audit:view"],
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  CAN_BO_TUYEN_SINH: "Cán bộ tuyển sinh",
  HOI_DONG: "Hội đồng tuyển sinh",
  LANH_DAO_KHOA: "Lãnh đạo khoa/viện",
  ADMIN: "Quản trị hệ thống",
};

export const ROLE_DESCRIPTION: Record<RoleCode, string> = {
  CAN_BO_TUYEN_SINH: "Cấu hình đợt tuyển sinh, tiếp nhận và thẩm định hồ sơ, xử lý phúc khảo.",
  HOI_DONG: "Xem hồ sơ, chấm điểm và xử lý đơn phúc khảo.",
  LANH_DAO_KHOA: "Phê duyệt chỉ tiêu và cấu hình ngành, theo dõi tiến độ.",
  ADMIN: "Cấp tài khoản cán bộ, phân quyền, xem nhật ký hệ thống.",
};

export const ALL_ROLES: RoleCode[] = ["CAN_BO_TUYEN_SINH", "HOI_DONG", "LANH_DAO_KHOA", "ADMIN"];

export function permissionsOf(roles: RoleCode[]): Set<Permission> {
  const set = new Set<Permission>();
  roles.forEach((r) => PERMISSION_MATRIX[r]?.forEach((p) => set.add(p)));
  return set;
}

export function can(roles: RoleCode[] | undefined, permission: Permission): boolean {
  if (!roles) return false;
  return roles.some((r) => PERMISSION_MATRIX[r]?.includes(permission));
}
