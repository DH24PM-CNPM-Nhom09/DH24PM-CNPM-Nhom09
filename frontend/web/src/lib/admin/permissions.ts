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
  | "audit:view"
  | "announcement:manage"
  | "candidate:view" // xem danh sách & thông tin tài khoản thí sinh
  | "candidate:manage" // khóa / mở khóa tài khoản thí sinh
  | "supervisor:manage" // ghi nhận GV đồng ý / từ chối hướng dẫn NCS, danh mục giảng viên
  | "exam:manage" // tổ chức thi tiếng Anh; lập tiểu ban, lịch phỏng vấn / trình bày đề cương, công bố điểm
  | "score:enter" // nhập điểm xét tuyển (thư ký tiểu ban / hội đồng)
  | "result:view" // xem điểm chuẩn, xếp hạng, kết quả xét tuyển
  | "result:propose" // hội đồng: định điểm chuẩn, xếp hạng, thông qua kết quả (cấp 1)
  | "result:approve" // lãnh đạo: phê duyệt và công bố kết quả (cấp 2)
  | "decision:manage" // lập quyết định trúng tuyển, theo dõi xác nhận nhập học, nhận bản chính, hoàn tất nhập học
  | "decision:sign" // lãnh đạo ký ban hành quyết định trúng tuyển
  | "complaint:view" // xem khiếu nại của thí sinh
  | "complaint:handle"; // tiếp nhận, trả lời khiếu nại

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
    "announcement:manage",
    "candidate:view",
    "supervisor:manage",
    "exam:manage",
    "score:enter",
    "result:view",
    "decision:manage",
    "complaint:view",
    "complaint:handle",
  ],
  HOI_DONG: ["dashboard:view", "application:view", "batch:view", "appeal:view", "appeal:resolve", "supervisor:manage", "score:enter", "result:view", "result:propose", "complaint:view", "complaint:handle"],
  LANH_DAO_KHOA: ["dashboard:view", "application:view", "batch:view", "batch:approve", "appeal:view", "audit:view", "result:view", "result:approve", "decision:sign", "complaint:view"],
  // Admin là quản trị KỸ THUẬT: cấp tài khoản, phân quyền, xem nhật ký — không
  // tham gia thẩm định hồ sơ (tách bạch trách nhiệm theo tài liệu Vai trò người dùng).
  ADMIN: ["dashboard:view", "batch:view", "account:manage", "audit:view", "candidate:view", "candidate:manage"],
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  CAN_BO_TUYEN_SINH: "Cán bộ tuyển sinh",
  HOI_DONG: "Hội đồng tuyển sinh",
  LANH_DAO_KHOA: "Lãnh đạo khoa/viện",
  ADMIN: "Quản trị hệ thống",
};

export const ROLE_DESCRIPTION: Record<RoleCode, string> = {
  CAN_BO_TUYEN_SINH: "Cấu hình đợt tuyển sinh, đăng thông báo, thẩm định hồ sơ, tổ chức xét tuyển (tiểu ban, lịch, điểm), lập quyết định trúng tuyển và làm thủ tục nhập học.",
  HOI_DONG: "Xem hồ sơ, chấm điểm, xử lý phúc khảo, định điểm chuẩn và thông qua kết quả xét tuyển.",
  LANH_DAO_KHOA: "Phê duyệt chỉ tiêu, phê duyệt và công bố kết quả xét tuyển, ký quyết định trúng tuyển.",
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
