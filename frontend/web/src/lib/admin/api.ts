// ============================================================================
// Lớp gọi API của phân hệ Quản lý.
//
// Chọn chế độ bằng biến môi trường trong .env.local:
//   NEXT_PUBLIC_ADMIN_USE_MOCK=false            -> gọi Backend NestJS thật
//   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
// Không đặt gì -> chạy dữ liệu mẫu trong trình duyệt (store.ts), mô phỏng đúng
// quy tắc nghiệp vụ của backend để demo khi chưa bật backend.
//
// Bảng endpoint đầy đủ cho Backend: xem README (mục "API phân hệ Quản lý").
// ============================================================================
import { can, type Permission } from "./permissions";
import { readSession, writeSession, type StaffSession } from "./session";
import { blockReason, TRANSITIONS, type ReviewAction } from "./stateMachine";
import { emitDataChange } from "./events";
import { commit, getDb, nextId, resetDb } from "./store";
import type {
  AdminApplication,
  AdminDb,
  AdmissionBatch,
  AdmissionMajor,
  AppealStatus,
  AuditLog,
  BatchMajor,
  BatchStatus,
  DegreeLevel,
  ExamSubject,
  ReviewStatus,
  RoleCode,
  ScoreAppeal,
  StaffAccount,
  StaffStatus,
  VerifyStatus,
} from "./types";

export const USE_MOCK = process.env.NEXT_PUBLIC_ADMIN_USE_MOCK !== "false";
/** Mật khẩu của tài khoản demo: dữ liệu mẫu chấp nhận mọi mật khẩu ≥ 6 ký tự; backend seed dùng Demo@123 */
export const DEMO_PASSWORD = "Demo@123";

// Nhãn tiếng Việt để nhật ký đọc được ngay, không phải tra mã trạng thái
const REVIEW_VI: Record<ReviewStatus, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Chờ tiếp nhận",
  UNDER_REVIEW: "Đang thẩm định",
  NEEDS_SUPPLEMENT: "Chờ bổ sung",
  APPROVED: "Đạt",
  REJECTED: "Không đạt",
};
const BATCH_VI: Record<BatchStatus, string> = {
  DRAFT: "Nháp",
  OPEN: "Mở đăng ký",
  CLOSED: "Đóng đăng ký",
  IN_REVIEW: "Xét kết quả",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy",
};
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export interface ApiError {
  error_code: string;
  message: string;
  detail?: string;
}

function fail(error_code: string, message: string): never {
  throw { error_code, message } satisfies ApiError;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readSession()?.accessToken;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw { error_code: "NETWORK", message: `Không kết nối được máy chủ (${API_BASE}). Kiểm tra backend đã chạy chưa.` } satisfies ApiError;
  }
  if (res.status === 401 && token) {
    // Phiên hết hạn hoặc tài khoản vừa bị khóa -> đăng xuất về trang đăng nhập
    writeSession(null);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Đã có lỗi xảy ra, vui lòng thử lại." }));
    // Backend chặn vì đang dùng mật khẩu tạm -> đánh dấu phiên để khung trang chuyển sang màn đổi mật khẩu
    const s = readSession();
    if (body?.error_code === "PASSWORD_CHANGE_REQUIRED" && s && !s.staff.mustChangePassword) writeSession({ ...s, staff: { ...s.staff, mustChangePassword: true } });
    throw body;
  }
  if ((options.method ?? "GET").toUpperCase() !== "GET") emitDataChange();
  return res.json();
}

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
}

// ---- Giả lập RbacGuard của Backend ----
function currentStaff(): StaffAccount {
  const s = readSession();
  if (!s) fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  const fresh = getDb().staff.find((x) => x.staffAccountId === s.staff.staffAccountId);
  if (!fresh || fresh.status !== "ACTIVE") {
    writeSession(null);
    fail("ACCOUNT_LOCKED", "Tài khoản của bạn đã bị khóa. Liên hệ quản trị hệ thống.");
  }
  return fresh;
}

function requirePermission(permission: Permission): StaffAccount {
  const me = currentStaff();
  if (!can(me.roles, permission)) fail("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  return me;
}

function audit(db: AdminDb, actorId: number | null, action: string, entityTable: string | null, entityId: number | null, detail: string, actorType: AuditLog["actorType"] = "STAFF") {
  db.auditLogs.unshift({ logId: nextId("audit"), actorType, actorId, action, entityTable, entityId, detail, createdAt: new Date().toISOString() });
}

function notifyCandidate(db: AdminDb, candidateId: number, content: string) {
  // Backend: NotificationService.notify('CANDIDATE', id, ...) -> gửi EMAIL + tạo bản ghi SYSTEM
  (["EMAIL", "SYSTEM"] as const).forEach((channel) =>
    db.notifications.unshift({
      notificationId: nextId("notification"),
      recipientType: "CANDIDATE",
      recipientId: candidateId,
      channel,
      content,
      status: "SENT",
      sentAt: new Date().toISOString(),
    }),
  );
}

// ============================================================================
// M1 — Đăng nhập cán bộ                    POST /auth/staff/login | /auth/staff/google
// ============================================================================
export async function staffLogin(email: string, password: string): Promise<StaffSession> {
  if (!USE_MOCK) {
    const session = await request<StaffSession>("/auth/staff/login", { method: "POST", body: JSON.stringify({ email, password }) });
    writeSession(session);
    return session;
  }
  const staff = getDb().staff.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
  await delay(null, 400);
  if (!staff) fail("STAFF_NOT_FOUND", "Email này chưa được cấp tài khoản cán bộ. Liên hệ quản trị hệ thống để được cấp quyền.");
  if (staff.status !== "ACTIVE") fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa. Liên hệ quản trị hệ thống để mở khóa.");
  if (!staff.hasPassword)
    fail("ERR_PASSWORD_LOGIN_DISABLED", "Tài khoản này chỉ đăng nhập bằng Google. Chọn “Đăng nhập với Google” bên dưới.");
  if (password.length < 6) fail("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
  const session = { accessToken: `mock-staff-${staff.staffAccountId}`, staff: structuredClone(staff) };
  writeSession(session);
  audit(getDb(), staff.staffAccountId, "STAFF_LOGIN", "staff_account", staff.staffAccountId, "Đăng nhập bằng mật khẩu");
  commit();
  return session;
}

/** Mock: nhận email để giả lập tài khoản Google đã chọn. Thật: truyền id_token từ Google Identity Services. */
export async function staffLoginWithGoogle(emailOrIdToken: string): Promise<StaffSession> {
  if (!USE_MOCK) {
    const session = await request<StaffSession>("/auth/staff/google", { method: "POST", body: JSON.stringify({ idToken: emailOrIdToken }) });
    writeSession(session);
    return session;
  }
  const staff = getDb().staff.find((s) => s.email.toLowerCase() === emailOrIdToken.trim().toLowerCase());
  await delay(null, 400);
  if (!staff) fail("STAFF_NOT_FOUND", "Tài khoản Google này chưa được cấp quyền cán bộ.");
  if (staff.status !== "ACTIVE") fail("ACCOUNT_LOCKED", "Tài khoản đang bị khóa. Liên hệ quản trị hệ thống để mở khóa.");
  const session = { accessToken: `mock-staff-${staff.staffAccountId}`, staff: structuredClone(staff) };
  writeSession(session);
  audit(getDb(), staff.staffAccountId, "STAFF_LOGIN", "staff_account", staff.staffAccountId, "Đăng nhập bằng Google");
  commit();
  return session;
}

export function staffLogout() {
  writeSession(null);
}

/** Backend thật: đọc lại vai trò mới nhất (Quản trị vừa đổi quyền) để menu hiển thị đúng */
export async function refreshStaff(): Promise<StaffAccount | null> {
  if (USE_MOCK) return null;
  const s = readSession();
  if (!s) return null;
  const staff = await request<StaffAccount>("/auth/staff/me");
  if (JSON.stringify(staff) !== JSON.stringify(s.staff)) writeSession({ ...s, staff });
  return staff;
}

/** Nút đăng nhập nhanh: luôn có ở dữ liệu mẫu; với API thật chỉ hiện khi NEXT_PUBLIC_DEMO_LOGIN=true */
export function demoAccounts(): Pick<StaffAccount, "staffAccountId" | "email" | "roles">[] {
  if (USE_MOCK) return structuredClone(getDb().staff.filter((s) => [1, 3, 5, 6].includes(s.staffAccountId)));
  if (process.env.NEXT_PUBLIC_DEMO_LOGIN !== "true") return [];
  return [
    { staffAccountId: 1, email: "canbo@agu.edu.vn", roles: ["CAN_BO_TUYEN_SINH"] },
    { staffAccountId: 3, email: "hoidong@agu.edu.vn", roles: ["HOI_DONG"] },
    { staffAccountId: 5, email: "lanhdao@agu.edu.vn", roles: ["LANH_DAO_KHOA"] },
    { staffAccountId: 6, email: "quantri@agu.edu.vn", roles: ["ADMIN"] },
  ];
}

/** Tải tệp minh chứng (kèm token) để xem trước — chỉ có khi dùng backend thật */
export async function fetchDocumentFile(documentId: number): Promise<Blob> {
  const token = readSession()?.accessToken;
  const res = await fetch(`${API_BASE}/admin/application-documents/${documentId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Không tải được tệp." }));
  return res.blob();
}

// ============================================================================
// Tra cứu dùng chung
// ============================================================================
export interface Lookups {
  batches: AdmissionBatch[];
  majors: AdmissionMajor[];
  batchMajors: BatchMajor[];
  staff: Pick<StaffAccount, "staffAccountId" | "fullName" | "staffCode">[];
}

export async function getLookups(): Promise<Lookups> {
  if (!USE_MOCK) return request<Lookups>("/admin/lookups");
  currentStaff();
  const db = getDb();
  return delay(
    {
      batches: db.batches,
      majors: db.majors,
      batchMajors: db.batchMajors,
      staff: db.staff.map(({ staffAccountId, fullName, staffCode }) => ({ staffAccountId, fullName, staffCode })),
    },
    120,
  );
}

// ============================================================================
// Bảng điều khiển                                   GET /admin/dashboard
// ============================================================================
export interface DashboardData {
  statusCounts: Record<ReviewStatus, number>;
  waitingOldestDays: number | null;
  myUnderReview: number;
  readyToConclude: number;
  overdueSupplements: number;
  pendingAppeals: number;
  configuringMajors: number;
  lockedAccounts: number;
  progress: { batchCode: string; batchName: string; rows: { batchMajorId: number; majorName: string; quota: number; submitted: number; approved: number }[] }[];
  recent: AuditLog[];
}

export async function getDashboard(): Promise<DashboardData> {
  if (!USE_MOCK) return request<DashboardData>("/admin/dashboard");
  const me = requirePermission("dashboard:view");
  const db = getDb();
  const now = Date.now();
  const openBatchIds = db.batches.filter((b) => b.status === "OPEN").map((b) => b.batchId);
  const openBmIds = db.batchMajors.filter((bm) => openBatchIds.includes(bm.batchId)).map((bm) => bm.batchMajorId);
  const apps = db.applications.filter((a) => !a.isCancelled && openBmIds.includes(a.batchMajorId));

  const statusCounts = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, NEEDS_SUPPLEMENT: 0, APPROVED: 0, REJECTED: 0 } as Record<ReviewStatus, number>;
  apps.forEach((a) => statusCounts[a.reviewStatus]++);
  const waiting = apps.filter((a) => a.reviewStatus === "SUBMITTED").map((a) => new Date(a.submittedAt).getTime());
  const oldest = waiting.length ? Math.min(...waiting) : null;

  return delay({
    statusCounts,
    waitingOldestDays: oldest === null ? null : Math.floor((now - oldest) / 86_400_000),
    myUnderReview: apps.filter((a) => a.reviewStatus === "UNDER_REVIEW" && a.assignedStaffId === me.staffAccountId).length,
    readyToConclude: apps.filter((a) => a.reviewStatus === "UNDER_REVIEW" && blockReason(a, "APPROVE") === null).length,
    overdueSupplements: apps.filter((a) => a.reviewStatus === "NEEDS_SUPPLEMENT" && blockReason(a, "REJECT_EXPIRED") === null).length,
    pendingAppeals: db.appeals.filter((p) => p.status === "PENDING").length,
    configuringMajors: db.batchMajors.filter((bm) => bm.status === "CONFIGURING").length,
    lockedAccounts: db.staff.filter((s) => s.status === "LOCKED").length,
    progress: db.batches
      .filter((b) => b.status === "OPEN")
      .map((b) => ({
        batchCode: b.batchCode,
        batchName: b.batchName,
        rows: db.batchMajors
          .filter((bm) => bm.batchId === b.batchId)
          .map((bm) => {
            const list = db.applications.filter((a) => a.batchMajorId === bm.batchMajorId && !a.isCancelled);
            return {
              batchMajorId: bm.batchMajorId,
              majorName: db.majors.find((m) => m.majorId === bm.majorId)?.majorName ?? "",
              quota: bm.quota,
              submitted: list.length,
              approved: list.filter((a) => a.reviewStatus === "APPROVED").length,
            };
          }),
      })),
    recent: can(me.roles, "audit:view") ? [...db.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6) : [],
  });
}

// ============================================================================
// M3/M4 — Danh sách & chi tiết hồ sơ       GET /admin/applications?…  GET /admin/applications/{id}
// ============================================================================
export interface ApplicationQuery {
  batchId?: number;
  majorId?: number;
  status?: ReviewStatus | "OVERDUE" | "READY";
  q?: string;
  sort?: "submitted_desc" | "submitted_asc";
  page?: number;
  pageSize?: number;
}

export interface ApplicationRow {
  applicationId: number;
  applicationCode: string;
  candidateName: string;
  candidateEmail: string;
  majorName: string;
  degreeLevel: DegreeLevel;
  batchCode: string;
  reviewStatus: ReviewStatus;
  submittedAt: string;
  paid: boolean;
  docsValid: number;
  docsTotal: number;
  overdue: boolean;
  assignedStaffName: string | null;
}

export interface ApplicationPage {
  items: ApplicationRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ReviewStatus | "ALL", number>;
}

export async function listApplications(query: ApplicationQuery): Promise<ApplicationPage> {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v !== undefined && v !== "" && params.set(k, String(v)));
    return request<ApplicationPage>(`/admin/applications?${params}`);
  }
  requirePermission("application:view");
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? 15;
  const q = (query.q ?? "").trim().toLowerCase();

  const bmOf = (id: number) => db.batchMajors.find((b) => b.batchMajorId === id)!;
  let list = db.applications.filter((a) => !a.isCancelled);
  if (query.batchId) list = list.filter((a) => bmOf(a.batchMajorId).batchId === query.batchId);
  if (query.majorId) list = list.filter((a) => bmOf(a.batchMajorId).majorId === query.majorId);
  if (q)
    list = list.filter(
      (a) =>
        a.applicationCode.toLowerCase().includes(q) ||
        a.candidate.fullName.toLowerCase().includes(q) ||
        (a.candidate.email ?? "").toLowerCase().includes(q) ||
        (a.candidate.idNumber ?? "").includes(q),
    );

  const counts = { ALL: list.length, DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, NEEDS_SUPPLEMENT: 0, APPROVED: 0, REJECTED: 0 } as ApplicationPage["counts"];
  list.forEach((a) => counts[a.reviewStatus]++);

  if (query.status === "OVERDUE") list = list.filter((a) => a.reviewStatus === "NEEDS_SUPPLEMENT" && blockReason(a, "REJECT_EXPIRED") === null);
  else if (query.status === "READY") list = list.filter((a) => a.reviewStatus === "UNDER_REVIEW" && blockReason(a, "APPROVE") === null);
  else if (query.status) list = list.filter((a) => a.reviewStatus === query.status);

  list = [...list].sort((a, b) => (query.sort === "submitted_asc" ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)));

  const items: ApplicationRow[] = list.slice((page - 1) * pageSize, page * pageSize).map((a) => {
    const bm = bmOf(a.batchMajorId);
    const major = db.majors.find((m) => m.majorId === bm.majorId)!;
    const batch = db.batches.find((b) => b.batchId === bm.batchId)!;
    return {
      applicationId: a.applicationId,
      applicationCode: a.applicationCode,
      candidateName: a.candidate.fullName,
      candidateEmail: a.candidate.email ?? "",
      majorName: major.majorName,
      degreeLevel: major.degreeLevel,
      batchCode: batch.batchCode,
      reviewStatus: a.reviewStatus,
      submittedAt: a.submittedAt,
      paid: a.payment?.gatewayStatus === "SUCCESS",
      docsValid: a.documents.filter((d) => d.verifyStatus === "VALID").length,
      docsTotal: a.documents.length,
      overdue: a.reviewStatus === "NEEDS_SUPPLEMENT" && blockReason(a, "REJECT_EXPIRED") === null,
      assignedStaffName: db.staff.find((s) => s.staffAccountId === a.assignedStaffId)?.fullName ?? null,
    };
  });
  return delay({ items, total: list.length, page, pageSize, counts });
}

export interface ApplicationDetail {
  application: AdminApplication;
  batch: AdmissionBatch;
  major: AdmissionMajor;
  batchMajor: BatchMajor;
  staffNames: Record<number, string>;
}

export async function getApplication(applicationId: number): Promise<ApplicationDetail> {
  if (!USE_MOCK) return request<ApplicationDetail>(`/admin/applications/${applicationId}`);
  requirePermission("application:view");
  const db = getDb();
  const application = db.applications.find((a) => a.applicationId === applicationId);
  if (!application) fail("NOT_FOUND", "Không tìm thấy hồ sơ.");
  const batchMajor = db.batchMajors.find((b) => b.batchMajorId === application.batchMajorId)!;
  const staffNames: Record<number, string> = {};
  db.staff.forEach((s) => (staffNames[s.staffAccountId] = s.fullName));
  return delay({
    application,
    batchMajor,
    batch: db.batches.find((b) => b.batchId === batchMajor.batchId)!,
    major: db.majors.find((m) => m.majorId === batchMajor.majorId)!,
    staffNames,
  });
}

/** PATCH /admin/application-documents/{documentId}/verify   { verifyStatus, reason } */
export async function verifyDocument(applicationId: number, documentId: number, verifyStatus: VerifyStatus, reason?: string) {
  if (!USE_MOCK)
    return request(`/admin/application-documents/${documentId}/verify`, { method: "PATCH", body: JSON.stringify({ verifyStatus, reason }) });
  const me = requirePermission("application:review");
  const db = getDb();
  const app = db.applications.find((a) => a.applicationId === applicationId);
  const doc = app?.documents.find((d) => d.documentId === documentId);
  if (!app || !doc) fail("NOT_FOUND", "Không tìm thấy minh chứng.");
  if (app.reviewStatus !== "UNDER_REVIEW") fail("INVALID_STATE", "Chỉ kiểm tra minh chứng khi hồ sơ đang thẩm định.");
  if (verifyStatus === "INVALID" && !reason?.trim()) fail("REASON_REQUIRED", "Nhập lý do minh chứng không hợp lệ.");
  doc.verifyStatus = verifyStatus;
  doc.invalidReason = verifyStatus === "INVALID" ? reason!.trim() : null;
  audit(db, me.staffAccountId, "DOCUMENT_VERIFY", "application_document", documentId, `${app.applicationCode}, ${doc.fileName}: ${verifyStatus === "VALID" ? "hợp lệ" : verifyStatus === "INVALID" ? "không hợp lệ" : "chưa kiểm tra"}${reason ? ` (${reason})` : ""}`);
  commit();
  return delay({ success: true }, 150);
}

export interface ReviewPayload {
  reason?: string;
  supplementContent?: string;
  deadline?: string;
}

/** PATCH /applications/{id}/review   { action, reason, supplementContent, deadline } — đúng endpoint Backend GĐ3 */
export async function reviewApplication(applicationId: number, action: ReviewAction, payload: ReviewPayload = {}) {
  if (!USE_MOCK)
    return request<{ success: boolean; reviewStatus: ReviewStatus; notified: boolean }>(`/applications/${applicationId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action, ...payload }),
    });
  const me = requirePermission("application:review");
  const db = getDb();
  const app = db.applications.find((a) => a.applicationId === applicationId);
  if (!app) fail("NOT_FOUND", "Không tìm thấy hồ sơ.");
  const blocked = blockReason(app, action);
  if (blocked) fail("INVALID_TRANSITION", blocked);

  const now = new Date().toISOString();
  const { from, to } = TRANSITIONS[action];
  let reason = payload.reason?.trim() || null;

  if (action === "REJECT" && (!reason || reason.length < 10)) fail("REASON_REQUIRED", "Lý do không đạt cần ít nhất 10 ký tự để thí sinh hiểu rõ.");
  if (action === "REQUEST_SUPPLEMENT") {
    const content = payload.supplementContent?.trim();
    if (!content || content.length < 10) fail("CONTENT_REQUIRED", "Nêu cụ thể giấy tờ cần bổ sung (ít nhất 10 ký tự).");
    if (!payload.deadline || new Date(payload.deadline).getTime() <= Date.now()) fail("INVALID_DEADLINE", "Hạn bổ sung phải sau thời điểm hiện tại.");
    app.supplements.unshift({
      requestId: nextId("supplement"),
      requestedByStaffId: me.staffAccountId,
      content,
      deadline: payload.deadline,
      status: "PENDING",
      createdAt: now,
      respondedAt: null,
    });
    reason = content;
  }
  if (action === "REJECT_EXPIRED") {
    const s = app.supplements.find((x) => x.status === "PENDING");
    if (s) s.status = "EXPIRED";
    reason = "Quá hạn bổ sung hồ sơ.";
  }
  if (action === "START_REVIEW") app.assignedStaffId = me.staffAccountId;

  app.reviewStatus = to;
  app.history.push({
    historyId: nextId("history"),
    oldStatus: from,
    newStatus: to,
    changedByType: "STAFF",
    changedByStaffId: me.staffAccountId,
    reason,
    changedAt: now,
  });
  audit(db, me.staffAccountId, `APPLICATION_${action}`, "application", applicationId, `${app.applicationCode}: ${REVIEW_VI[from]} → ${REVIEW_VI[to]}${reason ? `. ${reason}` : ""}`);

  const messages: Partial<Record<ReviewAction, string>> = {
    START_REVIEW: `Hồ sơ ${app.applicationCode} đã được tiếp nhận và đang thẩm định.`,
    APPROVE: `Hồ sơ ${app.applicationCode} đạt thẩm định, đủ điều kiện dự tuyển.`,
    REJECT: `Hồ sơ ${app.applicationCode} không đạt thẩm định. Lý do: ${reason}`,
    REQUEST_SUPPLEMENT: `Hồ sơ ${app.applicationCode} cần bổ sung: ${reason}. Hạn: ${new Date(payload.deadline ?? now).toLocaleString("vi-VN")}.`,
    REJECT_EXPIRED: `Hồ sơ ${app.applicationCode} không đạt do quá hạn bổ sung.`,
  };
  const msg = messages[action];
  if (msg) notifyCandidate(db, app.candidate.candidateId, msg);
  commit();
  return delay({ success: true, reviewStatus: to, notified: !!msg });
}

/** POST /admin/applications/bulk-start-review  { applicationIds } */
export async function bulkStartReview(applicationIds: number[]) {
  if (!USE_MOCK) return request<{ done: number; skipped: number }>("/admin/applications/bulk-start-review", { method: "POST", body: JSON.stringify({ applicationIds }) });
  let done = 0;
  let skipped = 0;
  for (const id of applicationIds) {
    try {
      await reviewApplication(id, "START_REVIEW");
      done++;
    } catch {
      skipped++;
    }
  }
  return { done, skipped };
}

// ============================================================================
// Lệ phí xét tuyển (chuyển khoản, cán bộ đối chiếu sao kê rồi xác nhận)
// ============================================================================
/** PATCH /admin/applications/{id}/payment/confirm   { receiptNo, transactionCode } */
export async function confirmPayment(applicationId: number, data: { receiptNo?: string; transactionCode?: string }) {
  if (!USE_MOCK)
    return request<{ success: boolean }>(`/admin/applications/${applicationId}/payment/confirm`, { method: "PATCH", body: JSON.stringify(data) });
  const me = requirePermission("application:review");
  const db = getDb();
  const app = db.applications.find((a) => a.applicationId === applicationId);
  if (!app) fail("NOT_FOUND", "Không tìm thấy hồ sơ.");
  if (!app.payment) fail("NO_PAYMENT", "Hồ sơ chưa phát sinh khoản lệ phí cần thu.");
  if (app.payment.gatewayStatus === "SUCCESS") fail("ALREADY_PAID", "Hồ sơ này đã được xác nhận nộp lệ phí.");
  app.payment.gatewayStatus = "SUCCESS";
  app.payment.paidAt = new Date().toISOString();
  app.payment.receiptNo = data.receiptNo?.trim() || null;
  app.payment.transactionCode = data.transactionCode?.trim() || app.payment.transactionCode;
  audit(db, me.staffAccountId, "PAYMENT_CONFIRM", "application_payment", app.payment.paymentId, `${app.applicationCode}: xác nhận đã thu lệ phí`);
  notifyCandidate(db, app.candidate.candidateId, `Phòng Đào tạo Sau đại học đã nhận lệ phí xét tuyển của hồ sơ ${app.applicationCode}.`);
  commit();
  return delay({ success: true });
}

export interface PaymentSettings {
  feeRegistration: number;
  feeThacSi: number;
  feeTienSi: number;
  feeEnglishTest: number;
  feeSupplementCredit: number;
  feeAppeal: number;
  /** Mã BIN NAPAS của ngân hàng (6 số) — cần để tạo mã VietQR */
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}
let mockPaymentSettings: PaymentSettings = { feeRegistration: 100000, feeThacSi: 360000, feeTienSi: 1000000, feeEnglishTest: 120000, feeSupplementCredit: 490000, feeAppeal: 360000, bankBin: "", bankName: "", accountNo: "", accountName: "" };

/** GET /admin/payment-settings */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  if (!USE_MOCK) return request<PaymentSettings>("/admin/payment-settings");
  requirePermission("application:view");
  return delay(mockPaymentSettings);
}

/** PUT /admin/payment-settings — mức lệ phí và tài khoản nhận chuyển khoản */
export async function updatePaymentSettings(data: PaymentSettings): Promise<PaymentSettings> {
  if (!USE_MOCK) return request<PaymentSettings>("/admin/payment-settings", { method: "PUT", body: JSON.stringify(data) });
  requirePermission("batch:manage");
  mockPaymentSettings = { ...data, accountNo: data.accountNo.replace(/\s/g, ""), accountName: data.accountName.trim().toUpperCase() };
  return delay(mockPaymentSettings);
}

// ============================================================================
// Danh mục ngành đào tạo                      GET/POST/PATCH /admin/majors
// ============================================================================
export interface MajorRow {
  majorId: number;
  majorCode: string;
  majorName: string;
  degreeLevel: DegreeLevel;
  facultyName: string;
  status: "ACTIVE" | "INACTIVE";
  batchCount: number;
  applicationCount: number;
}
export type MajorInput = { majorCode: string; majorName: string; degreeLevel: DegreeLevel; facultyName: string };
const mockMajorStatus = new Map<number, "ACTIVE" | "INACTIVE">();

export async function listMajors(): Promise<MajorRow[]> {
  if (!USE_MOCK) return request<MajorRow[]>("/admin/majors");
  requirePermission("batch:view");
  const db = getDb();
  return delay(
    db.majors.map((m) => {
      const bms = db.batchMajors.filter((b) => b.majorId === m.majorId);
      return {
        ...m,
        status: mockMajorStatus.get(m.majorId) ?? "ACTIVE",
        batchCount: bms.length,
        applicationCount: db.applications.filter((a) => bms.some((b) => b.batchMajorId === a.batchMajorId)).length,
      };
    }),
  );
}

export async function createMajor(input: MajorInput) {
  if (!USE_MOCK) return request<{ majorId: number }>("/admin/majors", { method: "POST", body: JSON.stringify(input) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const code = input.majorCode.trim().toUpperCase();
  if (!/^[0-9A-Z]{4,20}$/.test(code)) fail("VALIDATION", "Mã ngành gồm 4–20 chữ số hoặc chữ cái.");
  if (input.majorName.trim().length < 3) fail("VALIDATION", "Tên ngành cần từ 3 ký tự.");
  if (db.majors.some((m) => m.majorCode === code)) fail("DUPLICATE_CODE", `Mã ngành ${code} đã có trong danh mục.`);
  const majorId = Math.max(0, ...db.majors.map((x) => x.majorId)) + 1;
  db.majors.push({ majorId, majorCode: code, majorName: input.majorName.trim(), degreeLevel: input.degreeLevel, facultyName: input.facultyName.trim() });
  audit(db, me.staffAccountId, "MAJOR_CREATE", "admission_major", majorId, `Thêm ngành ${code} ${input.majorName.trim()}`);
  commit();
  return delay({ majorId });
}

export async function updateMajor(majorId: number, patch: Partial<MajorInput> & { status?: "ACTIVE" | "INACTIVE" }) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/majors/${majorId}`, { method: "PATCH", body: JSON.stringify(patch) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const m = db.majors.find((x) => x.majorId === majorId);
  if (!m) fail("NOT_FOUND", "Không tìm thấy ngành.");
  if (patch.majorName) m.majorName = patch.majorName.trim();
  if (patch.facultyName !== undefined) m.facultyName = patch.facultyName.trim();
  if (patch.status) mockMajorStatus.set(majorId, patch.status);
  audit(db, me.staffAccountId, "MAJOR_UPDATE", "admission_major", majorId, `Sửa ngành ${m.majorCode}`);
  commit();
  return delay({ success: true });
}

// ============================================================================
// Tài khoản thí sinh                         GET /admin/candidates …
// ============================================================================
export type CandidateAccountStatus = "ACTIVE" | "PENDING_VERIFY" | "LOCKED";
export interface CandidateAccountRow {
  accountId: number;
  candidateId: number | null;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  idNumberMasked: string | null;
  status: CandidateAccountStatus;
  hasPassword: boolean;
  tempLockedUntil: string | null;
  createdAt: string;
  profileComplete: boolean;
  application: { applicationId: number; applicationCode: string; reviewStatus: ReviewStatus; majorName: string } | null;
}
export interface CandidateAccountQuery {
  q?: string;
  status?: CandidateAccountStatus | "";
  profile?: "missing" | "done" | "";
  application?: "yes" | "no" | "";
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}
export interface CandidateAccountPage {
  page: number;
  pageSize: number;
  total: number;
  counts: Record<"ALL" | CandidateAccountStatus, number>;
  items: CandidateAccountRow[];
}
export interface CandidateAccountDetail {
  account: {
    accountId: number;
    email: string | null;
    phoneNumber: string | null;
    status: CandidateAccountStatus;
    hasPassword: boolean;
    emailVerified: boolean;
    createdAt: string;
    failedLoginCount: number;
    tempLockedUntil: string | null;
  };
  profile: { candidateId: number; fullName: string; dob: string | null; gender: "NAM" | "NU" | "KHAC" | null; idNumber: string | null; address: string | null; nationality: string } | null;
  applications: {
    applicationId: number;
    applicationCode: string;
    batchName: string;
    majorName: string;
    degreeLevel: DegreeLevel;
    reviewStatus: ReviewStatus;
    admissionStatus: string;
    isCancelled: boolean;
    createdAt: string;
    submittedAt: string | null;
    paymentStatus: string | null;
  }[];
  complaints: { complaintId: number; type: string; status: string; createdAt: string }[];
  lockHistory: { action: string; detail: string | null; by: string; at: string }[];
}

const qs = (o: object) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== "" && v !== null && p.set(k, String(v)));
  return p.toString();
};

// Dữ liệu mẫu: lấy thí sinh từ các hồ sơ mẫu; trạng thái khóa giữ trong bộ nhớ
const mockLocked = new Set<number>();
function mockCandidates(): CandidateAccountRow[] {
  const seen = new Map<number, CandidateAccountRow>();
  getDb().applications.forEach((a) => {
    const c = a.candidate;
    if (seen.has(c.candidateId)) return;
    seen.set(c.candidateId, {
      accountId: c.candidateId,
      candidateId: c.candidateId,
      fullName: c.fullName,
      email: c.email,
      phoneNumber: c.phoneNumber,
      idNumberMasked: c.idNumber ? `${"•".repeat(c.idNumber.length - 3)}${c.idNumber.slice(-3)}` : null,
      status: mockLocked.has(c.candidateId) ? "LOCKED" : "ACTIVE",
      hasPassword: false,
      tempLockedUntil: null,
      createdAt: a.submittedAt,
      profileComplete: Boolean(c.dob && c.gender && c.idNumber && c.address && c.phoneNumber),
      application: { applicationId: a.applicationId, applicationCode: a.applicationCode, reviewStatus: a.reviewStatus, majorName: "" },
    });
  });
  return Array.from(seen.values());
}

export async function listCandidateAccounts(query: CandidateAccountQuery): Promise<CandidateAccountPage> {
  if (!USE_MOCK) return request<CandidateAccountPage>(`/admin/candidates?${qs(query)}`);
  requirePermission("candidate:view");
  const text = (query.q ?? "").toLowerCase();
  const base = mockCandidates().filter((r) => !text || [r.fullName, r.email, r.phoneNumber, r.application?.applicationCode].some((v) => v?.toLowerCase().includes(text)));
  const rows = base.filter((r) => !query.status || r.status === query.status);
  const counts = { ALL: base.length, ACTIVE: base.filter((r) => r.status === "ACTIVE").length, PENDING_VERIFY: 0, LOCKED: base.filter((r) => r.status === "LOCKED").length };
  const page = query.page ?? 1,
    size = query.pageSize ?? 20;
  return delay({ page, pageSize: size, total: rows.length, counts, items: rows.slice((page - 1) * size, page * size) });
}

export async function getCandidateAccount(accountId: number): Promise<CandidateAccountDetail> {
  if (!USE_MOCK) return request<CandidateAccountDetail>(`/admin/candidates/${accountId}`);
  requirePermission("candidate:view");
  const app = getDb().applications.find((a) => a.candidate.candidateId === accountId);
  if (!app) fail("NOT_FOUND", "Không tìm thấy tài khoản thí sinh.");
  const c = app.candidate;
  return delay({
    account: { accountId, email: c.email, phoneNumber: c.phoneNumber, status: mockLocked.has(accountId) ? "LOCKED" : "ACTIVE", hasPassword: false, emailVerified: true, createdAt: app.submittedAt, failedLoginCount: 0, tempLockedUntil: null },
    profile: { candidateId: c.candidateId, fullName: c.fullName, dob: c.dob, gender: c.gender, idNumber: c.idNumber, address: c.address, nationality: "Việt Nam" },
    applications: [{ applicationId: app.applicationId, applicationCode: app.applicationCode, batchName: "", majorName: "", degreeLevel: "THAC_SI", reviewStatus: app.reviewStatus, admissionStatus: app.admissionStatus, isCancelled: app.isCancelled, createdAt: app.submittedAt, submittedAt: app.submittedAt, paymentStatus: app.payment?.gatewayStatus ?? null }],
    complaints: [],
    lockHistory: [],
  });
}

/** PATCH /admin/candidates/{id}/lock   { reason } */
export async function lockCandidateAccount(accountId: number, reason: string) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/candidates/${accountId}/lock`, { method: "PATCH", body: JSON.stringify({ reason }) });
  const me = requirePermission("candidate:manage");
  if (reason.trim().length < 5) fail("REASON_REQUIRED", "Nhập lý do khóa (ít nhất 5 ký tự).");
  mockLocked.add(accountId);
  const db = getDb();
  audit(db, me.staffAccountId, "CANDIDATE_LOCK", "candidate_account", accountId, `Khóa tài khoản thí sinh #${accountId}: ${reason.trim()}`);
  commit();
  emitDataChange();
  return delay({ success: true });
}

export async function unlockCandidateAccount(accountId: number) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/candidates/${accountId}/unlock`, { method: "PATCH" });
  const me = requirePermission("candidate:manage");
  mockLocked.delete(accountId);
  const db = getDb();
  audit(db, me.staffAccountId, "CANDIDATE_UNLOCK", "candidate_account", accountId, `Mở khóa tài khoản thí sinh #${accountId}`);
  commit();
  emitDataChange();
  return delay({ success: true });
}

/** Tải tệp CSV danh sách thí sinh theo bộ lọc (mở bằng Excel) */
export async function exportCandidateAccounts(query: CandidateAccountQuery): Promise<Blob> {
  if (USE_MOCK) {
    const rows = mockCandidates();
    const csv = "\uFEFF" + ["Họ và tên,Email,Điện thoại", ...rows.map((r) => [r.fullName, r.email, r.phoneNumber].map((v) => `"${v ?? ""}"`).join(","))].join("\r\n");
    return new Blob([csv], { type: "text/csv;charset=utf-8" });
  }
  const token = readSession()?.accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/admin/candidates/export?${qs({ ...query, page: undefined, pageSize: undefined })}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    fail("NETWORK", `Không kết nối được máy chủ (${API_BASE}). Kiểm tra backend đã chạy chưa.`);
  }
  if (!res.ok) throw await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Không xuất được danh sách." }));
  return res.blob();
}

// ============================================================================
// Giảng viên hướng dẫn (bậc tiến sĩ)       /admin/supervisor-requests, /admin/lecturers
// ============================================================================
export type SupervisorStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export interface SupervisorRequestRow {
  requestId: number;
  status: SupervisorStatus;
  requestedAt: string;
  respondedAt: string | null;
  responseNote: string | null;
  lecturer: { lecturerId: number; fullName: string; facultyName: string };
  candidateName: string;
  applicationId: number;
  applicationCode: string;
  reviewStatus: ReviewStatus;
  majorName: string;
  researchTopic: string;
  researchField: string | null;
}
export interface LecturerRow {
  lecturerId: number;
  lecturerCode: string;
  fullName: string;
  email: string | null;
  facultyName: string;
  status: "ACTIVE" | "INACTIVE";
  accepted: number;
  pending: number;
}
export interface LecturerInput {
  lecturerCode?: string;
  fullName?: string;
  email?: string;
  facultyName?: string;
  status?: "ACTIVE" | "INACTIVE";
}

// Dữ liệu mẫu (chế độ không có backend)
const mockLecturers: LecturerRow[] = [
  { lecturerId: 1, lecturerCode: "GV-CNTT-01", fullName: "PGS.TS Trần Văn Long", email: null, facultyName: "Khoa Công nghệ thông tin", status: "ACTIVE", accepted: 1, pending: 1 },
  { lecturerId: 2, lecturerCode: "GV-CNTT-02", fullName: "TS. Lê Thị Minh Thư", email: null, facultyName: "Khoa Công nghệ thông tin", status: "ACTIVE", accepted: 0, pending: 0 },
  { lecturerId: 3, lecturerCode: "GV-NN-01", fullName: "PGS.TS Nguyễn Văn Hòa", email: null, facultyName: "Khoa Nông nghiệp - Tài nguyên thiên nhiên", status: "ACTIVE", accepted: 0, pending: 0 },
];
const mockSupRequests: SupervisorRequestRow[] = [
  {
    requestId: 1,
    status: "PENDING",
    requestedAt: "2026-09-10T02:00:00Z",
    respondedAt: null,
    responseNote: null,
    lecturer: { lecturerId: 1, fullName: "PGS.TS Trần Văn Long", facultyName: "Khoa Công nghệ thông tin" },
    candidateName: "Nguyễn Văn An",
    applicationId: 1,
    applicationCode: "TS-2026-9480101-00001",
    reviewStatus: "UNDER_REVIEW",
    majorName: "Khoa học máy tính",
    researchTopic: "Ứng dụng học sâu trong dự báo năng suất lúa vùng ĐBSCL",
    researchField: "Khoa học dữ liệu",
  },
];

export async function listSupervisorRequests(query: { status?: SupervisorStatus | ""; q?: string } = {}) {
  if (!USE_MOCK) return request<{ counts: Record<"ALL" | SupervisorStatus, number>; items: SupervisorRequestRow[] }>(`/admin/supervisor-requests?${qs(query)}`);
  requirePermission("supervisor:manage");
  const t = (query.q ?? "").toLowerCase();
  const base = mockSupRequests.filter((r) => !t || `${r.candidateName} ${r.lecturer.fullName} ${r.researchTopic} ${r.applicationCode}`.toLowerCase().includes(t));
  const counts = { ALL: base.length, PENDING: 0, ACCEPTED: 0, REJECTED: 0 };
  base.forEach((r) => counts[r.status]++);
  return delay({ counts, items: base.filter((r) => !query.status || r.status === query.status) });
}

/** PATCH /admin/supervisor-requests/{id}/respond   { decision: ACCEPTED|REJECTED, note } */
export async function respondSupervisorRequest(requestId: number, decision: "ACCEPTED" | "REJECTED", note: string) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/supervisor-requests/${requestId}/respond`, { method: "PATCH", body: JSON.stringify({ decision, note }) });
  requirePermission("supervisor:manage");
  const r = mockSupRequests.find((x) => x.requestId === requestId);
  if (!r || r.status !== "PENDING") fail("STALE_STATUS", "Đề nghị này đã được xử lý.");
  if (decision === "REJECTED" && note.trim().length < 5) fail("REASON_REQUIRED", "Ghi lý do từ chối (ít nhất 5 ký tự).");
  Object.assign(r, { status: decision, respondedAt: new Date().toISOString(), responseNote: note.trim() || null });
  emitDataChange();
  return delay({ success: true });
}

export async function listLecturers(): Promise<LecturerRow[]> {
  if (!USE_MOCK) return request<LecturerRow[]>("/admin/lecturers");
  requirePermission("supervisor:manage");
  return delay(mockLecturers);
}

export async function createLecturer(data: LecturerInput) {
  if (!USE_MOCK) return request<{ lecturerId: number }>("/admin/lecturers", { method: "POST", body: JSON.stringify(data) });
  requirePermission("supervisor:manage");
  if (!data.fullName?.trim() || !data.lecturerCode?.trim()) fail("VALIDATION", "Nhập mã và họ tên giảng viên.");
  const row: LecturerRow = { lecturerId: Date.now(), lecturerCode: data.lecturerCode.trim().toUpperCase(), fullName: data.fullName.trim(), email: data.email?.trim() || null, facultyName: data.facultyName?.trim() ?? "", status: "ACTIVE", accepted: 0, pending: 0 };
  mockLecturers.push(row);
  emitDataChange();
  return delay({ lecturerId: row.lecturerId });
}

export async function updateLecturer(lecturerId: number, data: LecturerInput) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/lecturers/${lecturerId}`, { method: "PATCH", body: JSON.stringify(data) });
  requirePermission("supervisor:manage");
  const l = mockLecturers.find((x) => x.lecturerId === lecturerId);
  if (!l) fail("NOT_FOUND", "Không tìm thấy giảng viên.");
  Object.assign(l, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  emitDataChange();
  return delay({ success: true });
}

// ============================================================================
// Thi đánh giá năng lực tiếng Anh               /admin/english-test/...
// (chỉ thí sinh chọn "đăng ký dự thi" — không có chứng chỉ, không được miễn)
// ============================================================================
export type EnglishResult = "PENDING" | "PASSED" | "FAILED" | "ABSENT";
export interface EnglishBatch {
  batchId: number;
  batchCode: string;
  batchName: string;
  status: string;
  candidates: number;
}
export interface EnglishSession {
  sessionId: number;
  sessionCode: string;
  testAt: string;
  room: string;
  location: string | null;
  capacity: number;
  note: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  assigned: number;
  graded: number;
}
export interface EnglishCandidate {
  applicationId: number;
  applicationCode: string;
  fullName: string;
  dob: string | null;
  idNumber: string | null;
  majorName: string;
  reviewStatus: ReviewStatus;
  paid: boolean;
  registration: { sessionId: number; sessionCode: string; candidateNumber: string; seatNo: number; result: EnglishResult; score: number | null; note: string | null } | null;
}
export interface EnglishOverview {
  batch: { batchId: number; batchCode: string; batchName: string };
  sessions: EnglishSession[];
  candidates: EnglishCandidate[];
  stats: { total: number; assigned: number; unpaidUnassigned: number; passed: number; failed: number; absent: number };
}
export interface EnglishSessionInput {
  sessionCode: string;
  testAt: string;
  room: string;
  location: string;
  capacity: number;
  note: string;
}

const MOCK_ONLY = () => fail("NOT_SUPPORTED", "Chức năng thi tiếng Anh cần chạy cùng backend (NEXT_PUBLIC_ADMIN_USE_MOCK=false).");

export async function listEnglishBatches(): Promise<EnglishBatch[]> {
  if (!USE_MOCK) return request<EnglishBatch[]>("/admin/english-test/batches");
  requirePermission("exam:manage");
  return delay([]);
}
export async function getEnglishOverview(batchId: number): Promise<EnglishOverview> {
  if (!USE_MOCK) return request<EnglishOverview>(`/admin/english-test/batches/${batchId}`);
  return MOCK_ONLY();
}
export async function createEnglishSession(batchId: number, data: EnglishSessionInput) {
  if (!USE_MOCK) return request<{ sessionId: number }>(`/admin/english-test/batches/${batchId}/sessions`, { method: "POST", body: JSON.stringify(data) });
  return MOCK_ONLY();
}
export async function updateEnglishSession(sessionId: number, data: Partial<EnglishSessionInput> & { status?: "CANCELLED" }) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/english-test/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify(data) });
  return MOCK_ONLY();
}
export async function autoAssignEnglish(batchId: number, paidOnly: boolean) {
  if (!USE_MOCK) return request<{ assigned: number; notEnoughSeats: number }>(`/admin/english-test/batches/${batchId}/auto-assign`, { method: "POST", body: JSON.stringify({ paidOnly }) });
  return MOCK_ONLY();
}
export async function moveEnglishCandidate(applicationId: number, sessionId: number) {
  if (!USE_MOCK) return request<{ success: boolean }>(`/admin/english-test/registrations/${applicationId}/move`, { method: "PATCH", body: JSON.stringify({ sessionId }) });
  return MOCK_ONLY();
}
export async function saveEnglishResults(sessionId: number, items: { applicationId: number; result: EnglishResult; score: number | null; note: string }[]) {
  if (!USE_MOCK) return request<{ success: boolean; changed: number }>(`/admin/english-test/sessions/${sessionId}/results`, { method: "PUT", body: JSON.stringify({ items }) });
  return MOCK_ONLY();
}

/** CHỈ CÓ Ở MOCK: giả lập thí sinh nộp bổ sung (thật sẽ do phân hệ Thí sinh gọi) */
export async function simulateCandidateSupplement(applicationId: number) {
  if (!USE_MOCK) fail("NOT_SUPPORTED", "Chỉ dùng trong chế độ dữ liệu mẫu.");
  currentStaff();
  const db = getDb();
  const app = db.applications.find((a) => a.applicationId === applicationId);
  if (!app || app.reviewStatus !== "NEEDS_SUPPLEMENT") fail("INVALID_TRANSITION", "Hồ sơ không ở trạng thái chờ bổ sung.");
  const now = new Date().toISOString();
  const s = app.supplements.find((x) => x.status === "PENDING");
  if (s) {
    s.status = "RESOLVED";
    s.respondedAt = now;
  }
  app.documents.forEach((d) => {
    if (d.verifyStatus === "INVALID") {
      d.verifyStatus = "PENDING";
      d.invalidReason = null;
      d.fileName = d.fileName.replace(/(_bo_sung)?\.pdf$/, "_bo_sung.pdf");
      d.uploadedAt = now;
      d.fileHash = Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    }
  });
  app.reviewStatus = "UNDER_REVIEW";
  app.history.push({ historyId: nextId("history"), oldStatus: "NEEDS_SUPPLEMENT", newStatus: "UNDER_REVIEW", changedByType: "CANDIDATE", changedByStaffId: null, reason: "Thí sinh đã nộp bổ sung", changedAt: now });
  audit(db, app.candidate.candidateId, "SUPPLEMENT_SUBMIT", "supplement_request", s?.requestId ?? null, `${app.applicationCode}: thí sinh nộp bổ sung`, "CANDIDATE");
  commit();
  return delay({ success: true });
}

// ============================================================================
// M2 — Đợt tuyển sinh                          GET/POST /admission-batches …
// ============================================================================
export interface BatchSummary extends AdmissionBatch {
  majorCount: number;
  quotaTotal: number;
  applicationCount: number;
}

export async function listBatches(): Promise<BatchSummary[]> {
  if (!USE_MOCK) return request<BatchSummary[]>("/admission-batches?include=stats");
  requirePermission("batch:view");
  const db = getDb();
  const rows = db.batches.map((b) => {
    const bms = db.batchMajors.filter((bm) => bm.batchId === b.batchId);
    const ids = bms.map((x) => x.batchMajorId);
    return {
      ...b,
      majorCount: bms.length,
      quotaTotal: bms.reduce((s, x) => s + x.quota, 0),
      applicationCount: db.applications.filter((a) => ids.includes(a.batchMajorId) && !a.isCancelled).length,
    };
  });
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(rows);
}

export interface BatchDetail {
  batch: AdmissionBatch;
  /** Số hồ sơ chưa có kết luận thẩm định — chặn chuyển sang "Xét kết quả" */
  unresolvedCount: number;
  majors: (BatchMajor & { major: AdmissionMajor; applicationCount: number; approvedCount: number })[];
  allMajors: AdmissionMajor[];
  staffNames: Record<number, string>;
}

export async function getBatch(batchId: number): Promise<BatchDetail> {
  if (!USE_MOCK) return request<BatchDetail>(`/admission-batches/${batchId}`);
  requirePermission("batch:view");
  const db = getDb();
  const batch = db.batches.find((b) => b.batchId === batchId);
  if (!batch) fail("NOT_FOUND", "Không tìm thấy đợt tuyển sinh.");
  const staffNames: Record<number, string> = {};
  db.staff.forEach((s) => (staffNames[s.staffAccountId] = s.fullName));
  const bmIds = db.batchMajors.filter((bm) => bm.batchId === batchId).map((bm) => bm.batchMajorId);
  return delay({
    batch,
    unresolvedCount: db.applications.filter((a) => bmIds.includes(a.batchMajorId) && !a.isCancelled && ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"].includes(a.reviewStatus)).length,
    allMajors: db.majors,
    staffNames,
    majors: db.batchMajors
      .filter((bm) => bm.batchId === batchId)
      .map((bm) => {
        const apps = db.applications.filter((a) => a.batchMajorId === bm.batchMajorId && !a.isCancelled);
        return {
          ...bm,
          major: db.majors.find((m) => m.majorId === bm.majorId)!,
          applicationCount: apps.length,
          approvedCount: apps.filter((a) => a.reviewStatus === "APPROVED").length,
        };
      }),
  });
}

export interface CreateBatchDto {
  batchCode: string;
  batchName: string;
  degreeLevel: DegreeLevel;
  registrationStartAt: string;
  registrationEndAt: string;
  examStartAt: string | null;
  examEndAt: string | null;
  legalBasis: string;
}

export async function createBatch(dto: CreateBatchDto): Promise<AdmissionBatch> {
  if (!USE_MOCK) return request<AdmissionBatch>("/admission-batches", { method: "POST", body: JSON.stringify(dto) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const code = dto.batchCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(code)) fail("INVALID_CODE", "Mã đợt chỉ gồm chữ in hoa, số và dấu gạch ngang (3–30 ký tự).");
  if (db.batches.some((b) => b.batchCode === code)) fail("DUPLICATE_CODE", `Mã đợt ${code} đã tồn tại.`);
  if (new Date(dto.registrationEndAt) <= new Date(dto.registrationStartAt)) fail("INVALID_DATES", "Ngày kết thúc đăng ký phải sau ngày bắt đầu.");
  if (dto.examStartAt && new Date(dto.examStartAt) <= new Date(dto.registrationEndAt)) fail("INVALID_DATES", "Ngày thi phải sau khi đóng đăng ký.");
  if (dto.examStartAt && dto.examEndAt && new Date(dto.examEndAt) < new Date(dto.examStartAt)) fail("INVALID_DATES", "Ngày kết thúc thi phải sau ngày bắt đầu thi.");
  const batch: AdmissionBatch = {
    batchId: nextId("batch"),
    batchCode: code,
    batchName: dto.batchName.trim(),
    degreeLevel: dto.degreeLevel,
    registrationStartAt: dto.registrationStartAt,
    registrationEndAt: dto.registrationEndAt,
    examStartAt: dto.examStartAt,
    examEndAt: dto.examEndAt,
    legalBasis: dto.legalBasis.trim() || null,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
  };
  db.batches.push(batch);
  audit(db, me.staffAccountId, "BATCH_CREATE", "admission_batch", batch.batchId, `Tạo đợt ${code}`);
  commit();
  return delay(batch);
}

const BATCH_FLOW: Record<BatchStatus, BatchStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED"],
  CLOSED: ["IN_REVIEW"],
  IN_REVIEW: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextBatchStatuses(status: BatchStatus) {
  return BATCH_FLOW[status];
}

export function weightSum(subjects: ExamSubject[]) {
  return Math.round(subjects.reduce((s, x) => s + Number(x.weight || 0), 0) * 100) / 100;
}

/** Trả về danh sách lý do chưa thể chuyển trạng thái (rỗng = được phép) */
export function batchTransitionIssues(db: { batch: AdmissionBatch; majors: (BatchMajor & { major: AdmissionMajor })[] }, to: BatchStatus, unresolvedApps = 0): string[] {
  const issues: string[] = [];
  if (to === "OPEN") {
    if (db.majors.length === 0) issues.push("Đợt chưa có ngành tuyển sinh nào.");
    db.majors.forEach((m) => {
      if (m.status === "CONFIGURING") issues.push(`${m.major.majorName}: chưa được lãnh đạo phê duyệt chỉ tiêu.`);
      if (weightSum(m.subjects) !== 1) issues.push(`${m.major.majorName}: tổng trọng số môn thi là ${Math.round(weightSum(m.subjects) * 100)}%, cần đúng 100%.`);
    });
    if (new Date(db.batch.registrationEndAt).getTime() < Date.now()) issues.push("Thời hạn đăng ký đã qua, cập nhật lại lịch trước khi mở.");
  }
  if (to === "IN_REVIEW" && unresolvedApps > 0) issues.push(`Còn ${unresolvedApps} hồ sơ chưa có kết luận thẩm định.`);
  return issues;
}

/** PATCH /admission-batches/{id}/status  { status } */
export async function changeBatchStatus(batchId: number, to: BatchStatus) {
  if (!USE_MOCK) return request(`/admission-batches/${batchId}/status`, { method: "PATCH", body: JSON.stringify({ status: to }) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const batch = db.batches.find((b) => b.batchId === batchId);
  if (!batch) fail("NOT_FOUND", "Không tìm thấy đợt tuyển sinh.");
  if (!BATCH_FLOW[batch.status].includes(to)) fail("INVALID_TRANSITION", "Không thể chuyển sang trạng thái này.");
  const majors = db.batchMajors.filter((bm) => bm.batchId === batchId).map((bm) => ({ ...bm, major: db.majors.find((m) => m.majorId === bm.majorId)! }));
  const ids = majors.map((m) => m.batchMajorId);
  const unresolved = db.applications.filter((a) => ids.includes(a.batchMajorId) && !a.isCancelled && ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"].includes(a.reviewStatus)).length;
  const issues = batchTransitionIssues({ batch, majors }, to, unresolved);
  if (issues.length) fail("PRECONDITION_FAILED", issues.join(" "));
  const from = batch.status;
  batch.status = to;
  db.batchMajors
    .filter((bm) => bm.batchId === batchId)
    .forEach((bm) => {
      if (to === "OPEN" && bm.status === "APPROVED") bm.status = "OPEN";
      if (to === "CLOSED" && bm.status === "OPEN") bm.status = "CLOSED";
    });
  audit(db, me.staffAccountId, "BATCH_STATUS_CHANGE", "admission_batch", batchId, `${batch.batchCode}: ${BATCH_VI[from]} → ${BATCH_VI[to]}`);
  commit();
  return delay({ success: true });
}

/** POST /admission-batches/{id}/majors  { majorId, quota } */
export async function addBatchMajor(batchId: number, majorId: number, quota: number) {
  if (!USE_MOCK) return request(`/admission-batches/${batchId}/majors`, { method: "POST", body: JSON.stringify({ majorId, quota }) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const batch = db.batches.find((b) => b.batchId === batchId);
  const major = db.majors.find((m) => m.majorId === majorId);
  if (!batch || !major) fail("NOT_FOUND", "Không tìm thấy đợt hoặc ngành.");
  if (batch.status !== "DRAFT") fail("INVALID_STATE", "Chỉ thêm ngành khi đợt đang ở trạng thái Nháp.");
  if (major.degreeLevel !== batch.degreeLevel) fail("DEGREE_MISMATCH", "Ngành không cùng bậc đào tạo với đợt.");
  if (db.batchMajors.some((bm) => bm.batchId === batchId && bm.majorId === majorId)) fail("DUPLICATE", "Ngành đã có trong đợt.");
  if (!Number.isInteger(quota) || quota <= 0) fail("INVALID_QUOTA", "Chỉ tiêu phải là số nguyên dương.");
  const isPhd = batch.degreeLevel === "TIEN_SI";
  db.batchMajors.push({
    batchMajorId: nextId("batchMajor"),
    batchId,
    majorId,
    quota,
    benchmarkScore: null,
    status: "CONFIGURING",
    approvedByStaffId: null,
    subjects: [
      { subjectId: nextId("subject"), subjectName: isPhd ? "Đánh giá hồ sơ và đề cương nghiên cứu" : "Đánh giá hồ sơ học thuật", examFormat: "XET_HO_SO", weight: isPhd ? 0.6 : 0.4, maxScore: 10 },
      { subjectId: nextId("subject"), subjectName: isPhd ? "Trình bày đề cương trước tiểu ban" : "Phỏng vấn chuyên môn", examFormat: "PHONG_VAN", weight: isPhd ? 0.4 : 0.6, maxScore: 10 },
    ],
    conditions: [],
  });
  audit(db, me.staffAccountId, "BATCH_MAJOR_ADD", "admission_batch_major", null, `${batch.batchCode}: thêm ngành ${major.majorName}, chỉ tiêu ${quota}`);
  commit();
  return delay({ success: true });
}

/** PUT /admission-batch-majors/{id}  { quota, subjects } — đổi cấu hình thì phải được duyệt lại */
export async function updateBatchMajor(batchMajorId: number, data: { quota: number; subjects: (Omit<ExamSubject, "subjectId"> & { subjectId?: number })[] }) {
  if (!USE_MOCK) return request(`/admission-batch-majors/${batchMajorId}`, { method: "PUT", body: JSON.stringify(data) });
  const me = requirePermission("batch:manage");
  const db = getDb();
  const bm = db.batchMajors.find((x) => x.batchMajorId === batchMajorId);
  if (!bm) fail("NOT_FOUND", "Không tìm thấy cấu hình ngành.");
  const batch = db.batches.find((b) => b.batchId === bm.batchId)!;
  if (batch.status !== "DRAFT") fail("INVALID_STATE", "Đợt đã mở, không thể sửa chỉ tiêu và môn thi.");
  if (!Number.isInteger(data.quota) || data.quota <= 0) fail("INVALID_QUOTA", "Chỉ tiêu phải là số nguyên dương.");
  if (data.subjects.length === 0) fail("SUBJECTS_REQUIRED", "Cần ít nhất 1 môn thi / hình thức xét.");
  if (data.subjects.some((s) => !s.subjectName?.trim() || !(Number(s.weight) > 0))) fail("INVALID_SUBJECT", "Mỗi môn cần có tên và trọng số lớn hơn 0.");
  bm.quota = data.quota;
  bm.subjects = data.subjects.map((s) => ({
    subjectId: s.subjectId ?? nextId("subject"),
    subjectName: s.subjectName.trim(),
    examFormat: s.examFormat,
    weight: Math.round(Number(s.weight) * 100) / 100,
    maxScore: Number(s.maxScore) || 10,
  }));
  const wasApproved = bm.status === "APPROVED";
  bm.status = "CONFIGURING";
  bm.approvedByStaffId = null;
  audit(db, me.staffAccountId, "BATCH_MAJOR_UPDATE", "admission_batch_major", batchMajorId, `Cập nhật chỉ tiêu ${data.quota}, trọng số ${Math.round(weightSum(bm.subjects) * 100)}%${wasApproved ? " (cần duyệt lại)" : ""}`);
  commit();
  return delay({ success: true, needsReapproval: wasApproved });
}

/** PATCH /admission-batch-majors/{id}/approve — lãnh đạo phê duyệt */
export async function approveBatchMajor(batchMajorId: number) {
  if (!USE_MOCK) return request(`/admission-batch-majors/${batchMajorId}/approve`, { method: "PATCH" });
  const me = requirePermission("batch:approve");
  const db = getDb();
  const bm = db.batchMajors.find((x) => x.batchMajorId === batchMajorId);
  if (!bm) fail("NOT_FOUND", "Không tìm thấy cấu hình ngành.");
  if (bm.status !== "CONFIGURING") fail("INVALID_STATE", "Ngành này không ở trạng thái chờ duyệt.");
  if (weightSum(bm.subjects) !== 1) fail("WEIGHT_SUM_INVALID", `Tổng trọng số môn thi đang là ${Math.round(weightSum(bm.subjects) * 100)}%, cần đúng 100% mới phê duyệt được.`);
  bm.status = "APPROVED";
  bm.approvedByStaffId = me.staffAccountId;
  const major = db.majors.find((m) => m.majorId === bm.majorId)!;
  audit(db, me.staffAccountId, "BATCH_MAJOR_APPROVE", "admission_batch_major", batchMajorId, `Phê duyệt chỉ tiêu ${major.majorName}: ${bm.quota}`);
  commit();
  return delay({ success: true });
}

// ============================================================================
// M5 — Phúc khảo                         GET /score-appeals  POST /score-appeals/{id}/resolve
// ============================================================================
export interface AppealRow extends ScoreAppeal {
  applicationCode: string;
  candidateName: string;
  majorName: string;
  resolvedByName: string | null;
}

export async function listAppeals(): Promise<AppealRow[]> {
  if (!USE_MOCK) return request<AppealRow[]>("/score-appeals");
  requirePermission("appeal:view");
  const db = getDb();
  return delay(
    db.appeals
      .map((p) => {
        const app = db.applications.find((a) => a.applicationId === p.applicationId)!;
        const bm = db.batchMajors.find((b) => b.batchMajorId === app.batchMajorId)!;
        return {
          ...p,
          applicationCode: app.applicationCode,
          candidateName: app.candidate.fullName,
          majorName: db.majors.find((m) => m.majorId === bm.majorId)?.majorName ?? "",
          resolvedByName: db.staff.find((s) => s.staffAccountId === p.resolvedByStaffId)?.fullName ?? null,
        };
      })
      .sort((a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1) || a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function resolveAppeal(appealId: number, decision: { changed: boolean; newScore?: number; note: string }) {
  if (!USE_MOCK) return request(`/score-appeals/${appealId}/resolve`, { method: "POST", body: JSON.stringify(decision) });
  const me = requirePermission("appeal:resolve");
  const db = getDb();
  const p = db.appeals.find((x) => x.appealId === appealId);
  if (!p) fail("NOT_FOUND", "Không tìm thấy đơn phúc khảo.");
  if (p.status !== "PENDING") fail("ALREADY_RESOLVED", "Đơn này đã được xử lý.");
  if (decision.note.trim().length < 10) fail("NOTE_REQUIRED", "Ghi rõ kết luận của hội đồng (ít nhất 10 ký tự).");
  let status: AppealStatus = "RESOLVED_UNCHANGED";
  let newScore = p.oldScore;
  if (decision.changed) {
    const s = Number(decision.newScore);
    if (!(s >= 0 && s <= 10)) fail("INVALID_SCORE", "Điểm mới phải trong khoảng 0–10.");
    if (s === p.oldScore) fail("SCORE_UNCHANGED", "Điểm mới trùng điểm cũ — chọn “Giữ nguyên điểm”.");
    status = "RESOLVED_CHANGED";
    newScore = Math.round(s * 100) / 100;
  }
  p.status = status;
  p.newScore = newScore;
  p.resolvedAt = new Date().toISOString();
  p.resolvedByStaffId = me.staffAccountId;
  p.resolutionNote = decision.note.trim();
  const app = db.applications.find((a) => a.applicationId === p.applicationId)!;
  audit(db, me.staffAccountId, "APPEAL_RESOLVE", "score_appeal", appealId, `${app.applicationCode}, ${p.subjectName}: ${p.oldScore} → ${newScore}`);
  notifyCandidate(db, app.candidate.candidateId, `Kết quả phúc khảo môn ${p.subjectName}: ${status === "RESOLVED_CHANGED" ? `điều chỉnh từ ${p.oldScore} thành ${newScore}` : "giữ nguyên điểm"}.`);
  commit();
  return delay({ success: true });
}

// ============================================================================
// M1 — Tài khoản cán bộ (Admin)                  GET/POST/PATCH /staff-accounts
// ============================================================================
export async function listStaff(includeDeleted = false): Promise<StaffAccount[]> {
  if (!USE_MOCK) return request<StaffAccount[]>(`/staff-accounts${includeDeleted ? "?includeDeleted=true" : ""}`);
  requirePermission("account:manage");
  return delay(getDb().staff.filter((s) => includeDeleted || !s.deletedAt));
}

/** Cho cán bộ nghỉ việc: vô hiệu + ẩn tài khoản, KHÔNG xóa dữ liệu; hồ sơ đang phụ trách trả về hàng chờ */
export async function offboardStaff(staffAccountId: number, reason: string): Promise<{ releasedApplications: number }> {
  if (!USE_MOCK) return request<{ releasedApplications: number }>(`/staff-accounts/${staffAccountId}/offboard`, { method: "PATCH", body: JSON.stringify({ reason }) });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId && !x.deletedAt);
  if (!s) fail("NOT_FOUND", "Không tìm thấy tài khoản.");
  if (s.staffAccountId === me.staffAccountId) fail("SELF_OFFBOARD", "Không thể tự cho mình nghỉ việc.");
  if (s.roles.includes("ADMIN") && !db.staff.some((x) => x.staffAccountId !== s.staffAccountId && !x.deletedAt && x.status === "ACTIVE" && x.roles.includes("ADMIN")))
    fail("LAST_ADMIN", "Đây là tài khoản Quản trị duy nhất còn hoạt động. Hãy cấp vai trò Quản trị cho người khác trước.");
  let released = 0;
  db.applications.forEach((a) => {
    if (a.assignedStaffId === staffAccountId && ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"].includes(a.reviewStatus)) {
      a.assignedStaffId = null;
      released++;
    }
  });
  s.deletedAt = new Date().toISOString();
  s.status = "DISABLED";
  audit(db, me.staffAccountId, "STAFF_OFFBOARD", "staff_account", staffAccountId, `Cho nghỉ việc ${s.staffCode} (${s.fullName})${reason ? `: ${reason}` : ""}`);
  commit();
  return delay({ releasedApplications: released });
}

export async function restoreStaff(staffAccountId: number) {
  if (!USE_MOCK) return request(`/staff-accounts/${staffAccountId}/restore`, { method: "PATCH" });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId && x.deletedAt);
  if (!s) fail("NOT_FOUND", "Không tìm thấy cán bộ đã nghỉ việc này.");
  s.deletedAt = null;
  s.status = "ACTIVE";
  audit(db, me.staffAccountId, "STAFF_RESTORE", "staff_account", staffAccountId, `Khôi phục tài khoản ${s.staffCode} (${s.fullName})`);
  commit();
  return delay({ success: true });
}

export async function createStaff(dto: { staffCode: string; fullName: string; email: string; roles: RoleCode[]; allowPassword: boolean }): Promise<StaffAccount & { temporaryPassword?: string | null }> {
  if (!USE_MOCK) return request<StaffAccount & { temporaryPassword: string | null }>("/staff-accounts", { method: "POST", body: JSON.stringify(dto) });
  const me = requirePermission("account:manage");
  const db = getDb();
  const email = dto.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("INVALID_EMAIL", "Email không hợp lệ.");
  if (db.staff.some((s) => s.email === email)) fail("DUPLICATE_EMAIL", "Email đã được dùng cho tài khoản khác.");
  if (db.staff.some((s) => s.staffCode === dto.staffCode.trim().toUpperCase())) fail("DUPLICATE_CODE", "Mã cán bộ đã tồn tại.");
  if (dto.roles.length === 0) fail("ROLE_REQUIRED", "Chọn ít nhất 1 vai trò.");
  if (dto.fullName.trim().length < 3) fail("NAME_REQUIRED", "Nhập họ tên đầy đủ.");
  const staff: StaffAccount = {
    staffAccountId: nextId("staff"),
    staffCode: dto.staffCode.trim().toUpperCase(),
    fullName: dto.fullName.trim(),
    email,
    hasPassword: dto.allowPassword,
    status: "ACTIVE",
    roles: dto.roles,
  };
  db.staff.push(staff);
  audit(db, me.staffAccountId, "STAFF_CREATE", "staff_account", staff.staffAccountId, `Cấp tài khoản ${staff.staffCode} (${staff.roles.join(", ")})`);
  commit();
  return delay({ ...staff, temporaryPassword: dto.allowPassword ? `Tam${Math.random().toString(36).slice(2, 8)}` : null });
}

export async function updateStaffRoles(staffAccountId: number, roles: RoleCode[]) {
  if (!USE_MOCK) return request(`/staff-accounts/${staffAccountId}/roles`, { method: "PUT", body: JSON.stringify({ roles }) });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId);
  if (!s) fail("NOT_FOUND", "Không tìm thấy tài khoản.");
  if (roles.length === 0) fail("ROLE_REQUIRED", "Chọn ít nhất 1 vai trò.");
  if (s.staffAccountId === me.staffAccountId && !roles.includes("ADMIN"))
    fail("SELF_LOCKOUT", "Không thể tự gỡ vai trò Quản trị của chính mình.");
  const before = s.roles.join(", ");
  s.roles = roles;
  audit(db, me.staffAccountId, "STAFF_ROLE_UPDATE", "staff_role", staffAccountId, `${s.staffCode}: ${before} → ${roles.join(", ")}`);
  commit();
  return delay({ success: true });
}

export async function setStaffStatus(staffAccountId: number, status: StaffStatus) {
  if (!USE_MOCK) return request(`/staff-accounts/${staffAccountId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId);
  if (!s) fail("NOT_FOUND", "Không tìm thấy tài khoản.");
  if (s.staffAccountId === me.staffAccountId) fail("SELF_LOCKOUT", "Không thể khóa tài khoản đang đăng nhập.");
  s.status = status;
  audit(db, me.staffAccountId, status === "ACTIVE" ? "STAFF_UNLOCK" : "STAFF_LOCK", "staff_account", staffAccountId, `${status === "ACTIVE" ? "Mở khóa" : "Khóa"} tài khoản ${s.staffCode}`);
  commit();
  return delay({ success: true });
}

/** Quản trị sửa họ tên cán bộ (email, mã cán bộ là định danh nên không đổi) */
export async function updateStaffInfo(staffAccountId: number, fullName: string): Promise<StaffAccount> {
  if (!USE_MOCK) return request<StaffAccount>(`/staff-accounts/${staffAccountId}`, { method: "PATCH", body: JSON.stringify({ fullName }) });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId);
  if (!s) fail("NOT_FOUND", "Không tìm thấy tài khoản.");
  const name = fullName.trim().replace(/\s+/g, " ");
  if (name.length < 2) fail("NAME_REQUIRED", "Họ tên cần từ 2 đến 255 ký tự.");
  audit(db, me.staffAccountId, "STAFF_UPDATE", "staff_account", staffAccountId, `${s.staffCode}: đổi tên “${s.fullName}” → “${name}”`);
  s.fullName = name;
  commit();
  return delay(structuredClone(s));
}

/** Quản trị cấp lại mật khẩu tạm cho cán bộ (cán bộ bị bắt đổi ở lần đăng nhập tới) */
export async function resetStaffPassword(staffAccountId: number): Promise<{ temporaryPassword: string }> {
  if (!USE_MOCK) return request<{ temporaryPassword: string }>(`/staff-accounts/${staffAccountId}/reset-password`, { method: "PATCH" });
  const me = requirePermission("account:manage");
  const db = getDb();
  const s = db.staff.find((x) => x.staffAccountId === staffAccountId);
  if (!s) fail("NOT_FOUND", "Không tìm thấy tài khoản.");
  if (s.staffAccountId === me.staffAccountId) fail("SELF_RESET", "Để đổi mật khẩu của chính mình, dùng chức năng “Đổi mật khẩu”.");
  s.hasPassword = true;
  s.mustChangePassword = true;
  audit(db, me.staffAccountId, "STAFF_PASSWORD_RESET", "staff_account", staffAccountId, `Cấp lại mật khẩu tạm cho ${s.staffCode}`);
  commit();
  return delay({ temporaryPassword: `Tam${Math.random().toString(36).slice(2, 8)}9` });
}

/** Cán bộ tự đổi mật khẩu. Thành công: cập nhật phiên (bỏ cờ bắt đổi mật khẩu) */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<StaffAccount> {
  const session = readSession();
  if (!session) fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  let staff: StaffAccount;
  if (!USE_MOCK) {
    staff = await request<StaffAccount>("/auth/staff/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
  } else {
    await delay(null, 300);
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword))
      fail("WEAK_PASSWORD", "Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.");
    if (newPassword === currentPassword) fail("SAME_PASSWORD", "Mật khẩu mới phải khác mật khẩu hiện tại.");
    const db = getDb();
    const s = db.staff.find((x) => x.staffAccountId === session.staff.staffAccountId);
    if (s) s.mustChangePassword = false;
    audit(db, session.staff.staffAccountId, "STAFF_PASSWORD_CHANGE", "staff_account", session.staff.staffAccountId, "Tự đổi mật khẩu");
    commit();
    staff = { ...session.staff, mustChangePassword: false };
  }
  writeSession({ ...session, staff });
  emitDataChange();
  return staff;
}

// ============================================================================
// M8 — Nhật ký                                   GET /audit-logs?…
// ============================================================================
export async function listAuditLogs(query: { q?: string; actorType?: string; page?: number; pageSize?: number }) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v !== undefined && v !== "" && params.set(k, String(v)));
    return request<{ items: (AuditLog & { actorName: string })[]; total: number }>(`/audit-logs?${params}`);
  }
  requirePermission("audit:view");
  const db = getDb();
  const q = (query.q ?? "").trim().toLowerCase();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  let list = [...db.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (query.actorType) list = list.filter((l) => l.actorType === query.actorType);
  if (q) list = list.filter((l) => `${l.action} ${l.detail ?? ""} ${l.entityTable ?? ""}`.toLowerCase().includes(q));
  const actorName = (l: AuditLog) =>
    l.actorType === "STAFF"
      ? db.staff.find((s) => s.staffAccountId === l.actorId)?.fullName ?? `Cán bộ #${l.actorId}`
      : l.actorType === "CANDIDATE"
        ? db.applications.find((a) => a.candidate.candidateId === l.actorId)?.candidate.fullName ?? `Thí sinh #${l.actorId}`
        : "Hệ thống";
  return delay({
    items: list.slice((page - 1) * pageSize, page * pageSize).map((l) => ({ ...l, actorName: actorName(l) })),
    total: list.length,
  });
}

/** Mock: khôi phục dữ liệu mẫu ban đầu (dùng trước buổi demo) */
export async function resetMockData() {
  if (!USE_MOCK) return;
  resetDb();
  const s = readSession();
  if (s && !getDb().staff.some((x) => x.staffAccountId === s.staff.staffAccountId)) writeSession(null);
  return delay({ success: true }, 200);
}
