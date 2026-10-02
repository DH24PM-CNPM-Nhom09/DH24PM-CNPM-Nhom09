// ============================================================================
// Ma trận phân quyền — đúng quyết định GĐ3: KHÔNG có bảng permission trong DB,
// quyền chi tiết theo role_code khai báo bằng code. Bản này phải GIỐNG HỆT
// frontend/web/src/lib/admin/permissions.ts (frontend dùng để ẩn/hiện nút,
// backend dùng để chặn thật).
// ============================================================================
export type RoleCode = "CAN_BO_TUYEN_SINH" | "HOI_DONG" | "LANH_DAO_KHOA" | "ADMIN";

export type Permission =
  | "dashboard:view"
  | "application:view"
  | "application:review"
  | "batch:view"
  | "batch:manage"
  | "batch:approve"
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
  ADMIN: ["dashboard:view", "batch:view", "account:manage", "audit:view"],
};

export const ALL_ROLES = Object.keys(PERMISSION_MATRIX) as RoleCode[];

export function can(roles: string[], permission: Permission) {
  return roles.some((r) => PERMISSION_MATRIX[r as RoleCode]?.includes(permission));
}
