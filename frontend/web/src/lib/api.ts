// ============================================================================
// Lớp gọi API — nhóm Backend chỉ cần implement đúng các hàm bên dưới theo
// path /api/v1/... là Frontend chạy được ngay, không cần sửa gì ở đây.
//
// Mặc định chạy chế độ MOCK: trả dữ liệu giả để demo khi chưa bật Backend.
// Nối Backend thật: thêm vào file .env.local
//   NEXT_PUBLIC_USE_MOCK=false
//   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
// ============================================================================
import type { Application, ApplicationDocument, Candidate, CandidateNotification, EducationInput, FullApplication, LanguageOption, Lecturer, OtpSent, RegisterPayload, ResearchProposalInput, SupervisorOverview, SupervisorRequest } from "./types";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

function saveToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem("access_token", token);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
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
    throw { error_code: "NETWORK", message: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau." };
  }
  // Token cũ/hết hạn (ví dụ "mock-token" còn sót từ chế độ dữ liệu mẫu) -> xóa và về trang đăng nhập
  if (res.status === 401 && token && typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    if (!window.location.pathname.startsWith("/login"))
      window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Đã có lỗi xảy ra" }));
    throw body;
  }
  return res.json();
}

function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ---- Auth ----
export async function loginWithGoogle(googleIdToken: string) {
  if (USE_MOCK) {
    if (typeof window !== "undefined") localStorage.setItem("access_token", "mock-token");
    return delay({ accessToken: "mock-token", needsProfile: false, googleName: null as string | null });
  }
  const res = await request<{ accessToken: string; needsProfile?: boolean; googleName?: string | null }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken: googleIdToken }),
  });
  // Lưu token để các lần gọi sau tự gắn header Authorization
  if (typeof window !== "undefined") localStorage.setItem("access_token", res.accessToken);
  return res;
}

// ---- Đăng ký tài khoản + xác thực email bằng mã OTP ----
export async function registerAccount(payload: RegisterPayload): Promise<OtpSent> {
  if (USE_MOCK) return delay({ email: payload.email.trim().toLowerCase(), emailSent: false, expiresInMinutes: 5, resendAfterSeconds: 60, devOtp: "123456" });
  return request<OtpSent>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export async function verifyRegistration(email: string, otp: string) {
  if (USE_MOCK) {
    if (otp !== "123456") throw { error_code: "OTP_INVALID", message: "Mã xác thực không đúng (dữ liệu mẫu: 123456)." };
    saveToken("mock-token");
    return delay({ accessToken: "mock-token" });
  }
  const res = await request<{ accessToken: string }>("/auth/register/verify", { method: "POST", body: JSON.stringify({ email, otp }) });
  saveToken(res.accessToken);
  return res;
}

export async function resendRegistrationOtp(email: string): Promise<OtpSent> {
  if (USE_MOCK) return delay({ email, emailSent: false, expiresInMinutes: 5, resendAfterSeconds: 60, devOtp: "123456" });
  return request<OtpSent>("/auth/register/resend", { method: "POST", body: JSON.stringify({ email }) });
}

/** Đăng nhập bằng email hoặc số điện thoại + mật khẩu */
export async function loginWithPassword(emailOrPhone: string, password: string) {
  if (USE_MOCK) {
    saveToken("mock-token");
    return delay({ accessToken: "mock-token" });
  }
  const res = await request<{ accessToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ emailOrPhone, password }) });
  saveToken(res.accessToken);
  return res;
}

export async function requestPasswordResetOtp(emailOrPhone: string): Promise<OtpSent> {
  if (USE_MOCK) return delay({ resendAfterSeconds: 60, devOtp: "123456" });
  return request<OtpSent>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ emailOrPhone }) });
}

export async function resetPassword(emailOrPhone: string, otp: string, newPassword: string) {
  if (USE_MOCK) return delay({ success: true });
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ emailOrPhone, otp, newPassword }),
  });
}

// ---- Candidate profile ----
export async function getMyProfile(): Promise<Candidate> {
  if (USE_MOCK) {
    return delay({
      candidateId: 1,
      fullName: "Nguyễn Văn A",
      dob: "2001-05-12",
      gender: "NAM",
      idNumber: "089201001234",
      address: "123 Trần Hưng Đạo, P. Mỹ Xuyên, Long Xuyên, An Giang",
      email: "nguyenvana@gmail.com",
      phoneNumber: "0909000456",
      nationality: "Việt Nam",
      accountCreatedAt: "2026-08-20T03:00:00Z",
      hasPassword: true,
    });
  }
  return request<Candidate>("/candidates/me");
}

export async function updateMyProfile(data: Partial<Candidate>) {
  if (USE_MOCK) return delay({ success: true });
  return request("/candidates/me", { method: "PATCH", body: JSON.stringify(data) });
}

// ---- Applications ----
export async function getMyApplication(): Promise<Application | null> {
  if (USE_MOCK) {
    return delay({
      applicationId: 1,
      applicationCode: "HS2027-00458",
      reviewStatus: "UNDER_REVIEW",
      admissionStatus: "NONE",
      batchName: "Đợt tuyển sinh 2027",
      majorName: "Khoa học Máy tính",
      degreeLevel: "TIEN_SI",
      submittedAt: "2026-09-10T08:00:00Z",
    });
  }
  return request<Application>("/applications/me");
}

export async function getMyDocuments(): Promise<ApplicationDocument[]> {
  if (USE_MOCK) {
    return delay([
      { documentId: 1, documentType: "VAN_BANG", fileName: "van_bang_thac_si.pdf", fileSizeKb: 1200, verifyStatus: "VALID" },
      { documentId: 2, documentType: "BANG_DIEM", fileName: "bang_diem.pdf", fileSizeKb: 800, verifyStatus: "VALID" },
      { documentId: 3, documentType: "CHUNG_CHI_NGOAI_NGU", fileName: "ielts.pdf", fileSizeKb: 400, verifyStatus: "PENDING" },
    ]);
  }
  return request<ApplicationDocument[]>("/applications/me/documents");
}

export async function uploadDocument(applicationId: number, file: File, documentType: string): Promise<{ success: boolean; documentId?: number; duplicateWarning?: boolean }> {
  // Giới hạn đúng theo admission_db v3: 5MB/file, tổng <= 30MB/hồ sơ (kiểm tra
  // lại lần cuối ở Backend bằng trigger trg_document_size_limit — FE chỉ chặn sớm).
  const MAX_FILE_KB = 5120;
  if (file.size / 1024 > MAX_FILE_KB) {
    throw { error_code: "FILE_TOO_LARGE", message: "File vượt quá 5MB, vui lòng chọn file khác." };
  }
  if (USE_MOCK) return delay({ success: true });
  const form = new FormData();
  form.append("file", file);
  form.append("documentType", documentType);
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/applications/${applicationId}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw { error_code: "NETWORK", message: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau." };
  }
  if (!res.ok) throw await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Tải tệp thất bại, vui lòng thử lại." }));
  return res.json();
}

// ---- Tạo / hoàn thiện / nộp hồ sơ (UC-DK-01..05) ----
// Dữ liệu mẫu: giữ 1 hồ sơ trong bộ nhớ trình duyệt để demo đủ các bước khi chưa bật backend.
let mockApp: FullApplication | null = null;
function mockFull(): FullApplication {
  if (!mockApp) throw { error_code: "NOT_FOUND", message: "Không có hồ sơ nháp nào." };
  const have = new Set(mockApp.documents.map((d) => d.documentType));
  mockApp.missingDocuments = mockApp.requiredDocuments.filter((t) => !have.has(t));
  return structuredClone(mockApp);
}

export async function getMyFullApplication(): Promise<FullApplication | null> {
  if (USE_MOCK) return delay(mockApp ? mockFull() : null);
  return request<FullApplication | null>("/applications/me/full");
}

export async function getApplicationChecklist(): Promise<{ missingProfile: string[] }> {
  if (USE_MOCK) return delay({ missingProfile: [] });
  return request<{ missingProfile: string[] }>("/applications/me/checklist");
}

export async function getLecturers(): Promise<Lecturer[]> {
  if (USE_MOCK)
    return delay([
      { lecturerId: 1, fullName: "PGS.TS Trần Văn Long", facultyName: "Khoa Công nghệ thông tin" },
      { lecturerId: 2, fullName: "TS. Lê Thị Minh Thư", facultyName: "Khoa Công nghệ thông tin" },
    ]);
  return request<Lecturer[]>("/lecturers");
}

/** Bước 1+2: chọn ngành và khai quá trình đào tạo — tạo bản nháp lần đầu, các lần sau cập nhật */
export async function saveApplicationDraft(payload: { batchMajorId: number; education: EducationInput }, mockInfo?: { batch: FullApplication["batch"]; major: FullApplication["major"]; degreeLevel: FullApplication["degreeLevel"] }): Promise<FullApplication> {
  if (USE_MOCK) {
    const degree = mockInfo?.degreeLevel ?? "THAC_SI";
    const base: FullApplication = mockApp ?? {
      applicationId: 1,
      applicationCode: `${mockInfo?.batch.batchCode ?? "THS-2026"}-${mockInfo?.major.majorCode ?? "0000000"}-00001`,
      reviewStatus: "DRAFT",
      admissionStatus: "NONE",
      createdAt: new Date().toISOString(),
      submittedAt: null,
      degreeLevel: degree,
      batch: mockInfo!.batch,
      major: mockInfo!.major,
      education: null,
      proposal: null,
      documents: [],
      requiredDocuments: ["DON_DANG_KY", "SO_YEU_LY_LICH", "LY_LICH_CHUYEN_MON", "ANH_THE", "VAN_BANG", "BANG_DIEM", "CCCD", ...(degree === "TIEN_SI" ? (["DE_CUONG_NCS", "THU_GIOI_THIEU"] as const) : [])],
      optionalDocuments: ["GIAY_GIOI_THIEU", "CHUNG_CHI_NGOAI_NGU", "CHUNG_CHI_AI", "GIAY_UU_TIEN", "CONG_NHAN_VAN_BANG", "CONG_BO_KHOA_HOC", "KHAC"],
      missingDocuments: [],
      language: { option: null, note: null, requiredLevel: degree === "TIEN_SI" ? "bậc 4/6 (B2)" : "bậc 3/6 (B1)" },
      englishTest: null,
      payment: null,
      supplement: null,
      history: [],
      canEdit: true,
      fee: degree === "TIEN_SI" ? 1100000 : 460000,
      feeItems: [
        { code: "REGISTRATION", label: "Lệ phí đăng ký dự tuyển", amount: 100000 },
        { code: "REVIEW", label: `Lệ phí xét tuyển ${degree === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ"}`, amount: degree === "TIEN_SI" ? 1000000 : 360000 },
      ],
      otherFees: { supplementCredit: 490000, appeal: 360000, englishTest: 120000 },
    };
    mockApp = { ...base, ...(mockInfo ?? {}), education: payload.education };
    return delay(mockFull());
  }
  return request<FullApplication>("/applications/me/draft", { method: "POST", body: JSON.stringify(payload) });
}

/** Tải minh chứng cho hồ sơ nháp (dùng chung endpoint tải tệp) rồi trả về hồ sơ mới nhất */
export async function uploadDraftDocument(applicationId: number, file: File, documentType: ApplicationDocument["documentType"]) {
  const res = await uploadDocument(applicationId, file, documentType);
  if (USE_MOCK && mockApp) {
    mockApp.documents.push({ documentId: Date.now(), documentType, fileName: file.name, fileSizeKb: Math.max(1, Math.ceil(file.size / 1024)), verifyStatus: "PENDING", verifyNote: null, uploadedAt: new Date().toISOString() });
  }
  return res;
}

export async function deleteMyDocument(documentId: number) {
  if (USE_MOCK) {
    if (mockApp) mockApp.documents = mockApp.documents.filter((d) => d.documentId !== documentId);
    return delay({ success: true });
  }
  return request<{ success: boolean }>(`/applications/me/documents/${documentId}`, { method: "DELETE" });
}

/** Ngoại ngữ: có chứng chỉ / được miễn (kèm lý do) / đăng ký dự thi */
export async function saveLanguageChoice(option: LanguageOption, note: string): Promise<FullApplication> {
  if (USE_MOCK) {
    if (mockApp) {
      mockApp.language = { ...mockApp.language, option, note: option === "TEST" ? null : note };
      mockApp.feeItems = mockApp.feeItems.filter((f) => f.code !== "ENGLISH_TEST").concat(option === "TEST" ? [{ code: "ENGLISH_TEST", label: "Lệ phí đăng ký thi đánh giá năng lực tiếng Anh", amount: 120000 }] : []);
      mockApp.fee = mockApp.feeItems.reduce((t, f) => t + f.amount, 0);
      const base = ["DON_DANG_KY", "SO_YEU_LY_LICH", "LY_LICH_CHUYEN_MON", "ANH_THE", "VAN_BANG", "BANG_DIEM", "CCCD"] as FullApplication["requiredDocuments"];
      mockApp.requiredDocuments = [...base, ...(mockApp.degreeLevel === "TIEN_SI" ? (["DE_CUONG_NCS", "THU_GIOI_THIEU"] as const) : []), ...(option === "CERTIFICATE" ? (["CHUNG_CHI_NGOAI_NGU"] as const) : [])];
    }
    return delay(mockFull());
  }
  return request<FullApplication>("/applications/me/language", { method: "PUT", body: JSON.stringify({ option, note }) });
}

export async function saveResearchProposal(payload: ResearchProposalInput): Promise<FullApplication> {
  if (USE_MOCK) {
    if (mockApp) mockApp.proposal = { ...payload, lecturerName: payload.preferredLecturerId ? "PGS.TS Trần Văn Long" : null, supervisorStatus: null };
    return delay(mockFull());
  }
  return request<FullApplication>("/applications/me/proposal", { method: "PUT", body: JSON.stringify(payload) });
}

export async function submitMyApplication(): Promise<FullApplication> {
  if (USE_MOCK) {
    const a = mockFull();
    if (a.missingDocuments.length) throw { error_code: "APPLICATION_INCOMPLETE", message: "Chưa nộp được hồ sơ. Còn thiếu minh chứng bắt buộc." };
    const now = new Date().toISOString();
    mockApp = {
      ...a,
      reviewStatus: "SUBMITTED",
      submittedAt: now,
      canEdit: false,
      history: [{ status: "SUBMITTED", at: now, by: "CANDIDATE", reason: "Thí sinh nộp hồ sơ" }],
      payment: { amount: a.fee, status: "PENDING", method: "BANK_TRANSFER", receiptNo: null, paidAt: null, transferContent: a.applicationCode.replace(/[^A-Za-z0-9]/g, ""), bank: { bankBin: "", bankName: "", accountNo: "", accountName: "" } },
    };
    return delay(mockFull());
  }
  return request<FullApplication>("/applications/me/submit", { method: "POST", body: JSON.stringify({ agree: true }) });
}

export async function cancelMyDraft() {
  if (USE_MOCK) {
    mockApp = null;
    return delay({ success: true });
  }
  return request<{ success: boolean }>("/applications/me/cancel", { method: "POST" });
}

/** Thí sinh báo đã nộp lại xong các minh chứng được yêu cầu bổ sung */
export async function submitSupplement() {
  if (USE_MOCK) {
    if (mockApp) mockApp = { ...mockApp, reviewStatus: "UNDER_REVIEW", supplement: null };
    return delay({ success: true });
  }
  return request<{ success: boolean }>("/applications/me/supplement", { method: "POST" });
}

// ---- Xét tuyển: phúc khảo, xác nhận nhập học (chỉ chạy cùng backend) ----
const NEED_BACKEND = () => Promise.reject({ error_code: "NOT_SUPPORTED", message: "Chức năng này cần chạy cùng backend (NEXT_PUBLIC_USE_MOCK=false)." });

export async function fileScoreAppeal(subjectIds: number[], reason: string) {
  if (USE_MOCK) return NEED_BACKEND();
  return request<{ success: boolean }>("/applications/me/appeal", { method: "POST", body: JSON.stringify({ subjectIds, reason }) });
}
export async function confirmEnrollment() {
  if (USE_MOCK) return NEED_BACKEND();
  return request<{ success: boolean }>("/applications/me/enrollment/confirm", { method: "POST" });
}
export async function declineEnrollment(reason: string) {
  if (USE_MOCK) return NEED_BACKEND();
  return request<{ success: boolean; promoted: number }>("/applications/me/enrollment/decline", { method: "POST", body: JSON.stringify({ reason }) });
}

// ---- GVHD (bậc Tiến sĩ) ----
export async function getMySupervisorRequest(): Promise<SupervisorRequest | null> {
  if (USE_MOCK) {
    return delay({
      requestId: 1,
      lecturerName: "PGS.TS Trần Văn Long",
      facultyName: "Khoa Công nghệ Thông tin — Trường Đại học An Giang",
      status: "PENDING",
      requestedAt: "2026-09-10T00:00:00Z",
    });
  }
  return request<SupervisorRequest>("/applications/me/supervisor-request");
}

// ---- Khiếu nại / Phúc khảo ----
export interface MyComplaint {
  complaintId: number;
  type: string;
  typeLabel: string;
  content: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  response: string | null;
  createdAt: string;
  resolvedAt: string | null;
  applicationCode: string | null;
}
export async function getMyComplaints(): Promise<MyComplaint[]> {
  if (USE_MOCK) return delay([]);
  return request<MyComplaint[]>("/complaints/me");
}

export async function submitComplaint(payload: { type: string; applicationCode: string; content: string }) {
  if (USE_MOCK) return delay({ success: true });
  return request("/complaints", { method: "POST", body: JSON.stringify(payload) });
}

// ---- Thông báo cá nhân (kết quả xử lý hồ sơ, yêu cầu bổ sung...) ----
export async function getMyNotifications(): Promise<CandidateNotification[]> {
  if (USE_MOCK) {
    return delay([
      { notificationId: 2, title: "Hồ sơ cần bổ sung", content: "Chứng chỉ ngoại ngữ chưa rõ nét. Vui lòng tải bản scan rõ hơn trước hạn.", createdAt: new Date(Date.now() - 86_400_000).toISOString(), readAt: null },
      { notificationId: 1, title: "Đã tiếp nhận hồ sơ", content: "Hồ sơ HS2027-00458 đã được cán bộ tiếp nhận thẩm định.", createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), readAt: new Date().toISOString() },
    ]);
  }
  return request<CandidateNotification[]>("/notifications/me");
}

export async function markNotificationRead(notificationId: number) {
  if (USE_MOCK) return delay({ updated: 1 });
  return request<{ updated: number }>(`/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  if (USE_MOCK) return delay({ updated: 0 });
  return request<{ updated: number }>("/notifications/me/read-all", { method: "PATCH" });
}

// ---- Giảng viên hướng dẫn (bậc tiến sĩ) ----
let mockSupervisor: SupervisorOverview = {
  state: "DOCTORAL",
  applicationCode: "TS-2026-9480101-00001",
  reviewStatus: "UNDER_REVIEW",
  degreeLevel: "TIEN_SI",
  majorName: "Khoa học máy tính",
  researchTopic: "Ứng dụng học sâu trong dự báo năng suất lúa vùng ĐBSCL",
  researchField: "Khoa học dữ liệu",
  requests: [{ requestId: 1, lecturerId: 1, lecturerName: "PGS.TS Trần Văn Long", facultyName: "Khoa Công nghệ thông tin", status: "PENDING", requestedAt: "2026-09-10T00:00:00Z", respondedAt: null, responseNote: null }],
  canRequest: false,
  remaining: 2,
};

export async function getMySupervisors(): Promise<SupervisorOverview> {
  if (USE_MOCK) return delay(structuredClone(mockSupervisor));
  return request<SupervisorOverview>("/supervisors/me");
}

/** Gửi đề nghị hướng dẫn tới giảng viên (lần đầu hoặc sau khi bị từ chối) */
export async function requestSupervisor(lecturerId: number): Promise<SupervisorOverview> {
  if (USE_MOCK) {
    if (mockSupervisor.state === "DOCTORAL") {
      mockSupervisor = {
        ...mockSupervisor,
        canRequest: false,
        remaining: mockSupervisor.remaining - 1,
        requests: [{ requestId: Date.now(), lecturerId, lecturerName: "Giảng viên đã chọn", facultyName: "", status: "PENDING", requestedAt: new Date().toISOString(), respondedAt: null, responseNote: null }, ...mockSupervisor.requests],
      };
    }
    return delay(structuredClone(mockSupervisor));
  }
  return request<SupervisorOverview>("/supervisors/me/request", { method: "POST", body: JSON.stringify({ lecturerId }) });
}
