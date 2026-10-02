// ============================================================================
// Lớp gọi API — nhóm Backend chỉ cần implement đúng các hàm bên dưới theo
// path /api/v1/... là Frontend chạy được ngay, không cần sửa gì ở đây.
//
// Mặc định chạy chế độ MOCK: trả dữ liệu giả để demo khi chưa bật Backend.
// Nối Backend thật: thêm vào file .env.local
//   NEXT_PUBLIC_USE_MOCK=false
//   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
// ============================================================================
import type { Application, ApplicationDocument, Candidate, CandidateNotification, OtpSent, RegisterPayload, SupervisorRequest } from "./types";

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
    return delay({ accessToken: "mock-token" });
  }
  const res = await request<{ accessToken: string }>("/auth/google", {
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

export async function uploadDocument(applicationId: number, file: File, documentType: string) {
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
  const res = await fetch(`${API_BASE}/applications/${applicationId}/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw await res.json();
  return res.json();
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
