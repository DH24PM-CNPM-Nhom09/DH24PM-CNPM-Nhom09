// ============================================================================
// Kiểu dữ liệu cho phân hệ Quản lý (Admin Portal).
// Tên trường bám đúng cột trong admission_db v3 (đổi snake_case -> camelCase)
// để khi nối Backend thật (NestJS + Prisma) chỉ cần map 1-1, không đổi logic.
// ============================================================================
import type { AdmissionStatus, DocumentType, ReviewStatus } from "../types";

export type { AdmissionStatus, DocumentType, ReviewStatus };

// ---- M1: tài khoản cán bộ & phân quyền (bảng staff_account, role, staff_role) ----
// role_code đúng như comment trong admission_db_v3.sql
export type RoleCode = "CAN_BO_TUYEN_SINH" | "HOI_DONG" | "LANH_DAO_KHOA" | "ADMIN";

export type StaffStatus = "ACTIVE" | "LOCKED" | "DISABLED";

export interface StaffAccount {
  staffAccountId: number;
  staffCode: string;
  fullName: string;
  email: string;
  /** null = tài khoản chỉ đăng nhập bằng Google (password_hash NULL theo migration v3) */
  hasPassword: boolean;
  /** Đang dùng mật khẩu tạm do quản trị cấp -> phải đổi trước khi dùng hệ thống */
  mustChangePassword?: boolean;
  status: StaffStatus;
  /** Có giá trị = cán bộ đã nghỉ việc (ẩn khỏi danh sách, không đăng nhập được, giữ lịch sử) */
  deletedAt?: string | null;
  roles: RoleCode[];
}

// ---- M2: cấu hình đợt tuyển sinh ----
export type DegreeLevel = "THAC_SI" | "TIEN_SI";
export type BatchStatus = "DRAFT" | "OPEN" | "CLOSED" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";
export type BatchMajorStatus = "CONFIGURING" | "APPROVED" | "OPEN" | "CLOSED";
export type ExamFormat = "THI_VIET" | "PHONG_VAN" | "XET_HO_SO";

export interface AdmissionMajor {
  majorId: number;
  majorCode: string;
  majorName: string;
  degreeLevel: DegreeLevel;
  facultyName: string;
}

export interface ExamSubject {
  subjectId: number;
  subjectName: string;
  examFormat: ExamFormat;
  weight: number;
  maxScore: number;
}

export interface AdmissionCondition {
  conditionId: number;
  conditionCode: string;
  description: string;
  minGpa: number | null;
  requiredCertificate: string | null;
  isMandatory: boolean;
}

export interface BatchMajor {
  batchMajorId: number;
  batchId: number;
  majorId: number;
  quota: number;
  benchmarkScore: number | null;
  status: BatchMajorStatus;
  subjects: ExamSubject[];
  conditions: AdmissionCondition[];
  approvedByStaffId: number | null;
}

export interface AdmissionBatch {
  batchId: number;
  batchCode: string;
  batchName: string;
  degreeLevel: DegreeLevel;
  registrationStartAt: string;
  registrationEndAt: string;
  examStartAt: string | null;
  examEndAt: string | null;
  legalBasis: string | null;
  status: BatchStatus;
  createdAt: string;
}

// ---- M3 + M4: hồ sơ & thẩm định ----
export type VerifyStatus = "PENDING" | "VALID" | "INVALID";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "CANCELLED" | "EXPIRED";
export type PaymentMethod = "BANK_TRANSFER" | "MOMO" | "VNPAY" | "KHAC";

export interface AdminCandidate {
  candidateId: number;
  fullName: string;
  dob: string | null;
  gender: "NAM" | "NU" | "KHAC" | null;
  idNumber: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  /** Học vấn kê khai lúc nộp hồ sơ (UC-DK-02, bảng application_education — v4). null = chưa kê khai */
  graduatedFrom: string | null;
  graduatedMajor: string | null;
  graduationYear: number | null;
  gpa: number | null;
  /** Thang điểm GPA: 4 hoặc 10 */
  gpaScale?: number;
}

export interface AdminDocument {
  documentId: number;
  documentType: DocumentType;
  fileName: string;
  fileSizeKb: number;
  fileHash: string;
  verifyStatus: VerifyStatus;
  uploadedAt: string;
  /** Lý do không hợp lệ — FE giữ để đưa vào nội dung yêu cầu bổ sung; Backend ghi vào audit_log.detail */
  invalidReason: string | null;
}

export interface Payment {
  paymentId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionCode: string | null;
  gatewayStatus: PaymentStatus;
  paidAt: string | null;
  /** Số biên lai do Phòng Đào tạo cấp khi xác nhận đã thu */
  receiptNo?: string | null;
  /** Nội dung chuyển khoản thí sinh được hướng dẫn ghi: "<mã hồ sơ> <mã thí sinh>" */
  transferContent?: string;
}

export type SupplementStatus = "PENDING" | "RESOLVED" | "EXPIRED";

export interface SupplementRequest {
  requestId: number;
  requestedByStaffId: number | null;
  content: string;
  deadline: string;
  status: SupplementStatus;
  createdAt: string;
  respondedAt: string | null;
}

export type ChangedByType = "STAFF" | "SYSTEM" | "CANDIDATE";

export interface StatusHistoryEntry {
  historyId: number;
  oldStatus: ReviewStatus | null;
  newStatus: ReviewStatus;
  changedByType: ChangedByType;
  changedByStaffId: number | null;
  reason: string | null;
  changedAt: string;
}

export interface AdminApplication {
  applicationId: number;
  applicationCode: string;
  candidate: AdminCandidate;
  batchMajorId: number;
  reviewStatus: ReviewStatus;
  admissionStatus: AdmissionStatus;
  isCancelled: boolean;
  submittedAt: string;
  /** Cán bộ đang phụ trách thẩm định (người bấm "Tiếp nhận") */
  assignedStaffId: number | null;
  documents: AdminDocument[];
  /** null = thí sinh chưa phát sinh giao dịch lệ phí nào */
  payment: Payment | null;
  supplements: SupplementRequest[];
  history: StatusHistoryEntry[];
}

// ---- M5: phúc khảo (score_appeal) ----
export type AppealStatus = "PENDING" | "RESOLVED_CHANGED" | "RESOLVED_UNCHANGED";

export interface ScoreAppeal {
  appealId: number;
  applicationId: number;
  subjectName: string;
  reason: string;
  oldScore: number;
  newScore: number | null;
  status: AppealStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByStaffId: number | null;
  resolutionNote: string | null;
}

// ---- M8: nhật ký & thông báo ----
export type ActorType = "CANDIDATE" | "STAFF" | "SYSTEM";

export interface AuditLog {
  logId: number;
  actorType: ActorType;
  actorId: number | null;
  action: string;
  entityTable: string | null;
  entityId: number | null;
  detail: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  notificationId: number;
  recipientType: "CANDIDATE" | "STAFF";
  recipientId: number;
  channel: "EMAIL" | "SMS" | "SYSTEM";
  content: string;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt: string | null;
}

// ---- Toàn bộ "CSDL giả" của chế độ MOCK ----
export interface AdminDb {
  version: number;
  seededAt: string;
  staff: StaffAccount[];
  majors: AdmissionMajor[];
  batches: AdmissionBatch[];
  batchMajors: BatchMajor[];
  applications: AdminApplication[];
  appeals: ScoreAppeal[];
  auditLogs: AuditLog[];
  notifications: NotificationRecord[];
  seq: Record<string, number>;
}
