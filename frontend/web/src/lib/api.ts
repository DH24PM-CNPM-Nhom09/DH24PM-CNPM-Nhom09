// ============================================================================
// Lớp gọi API — nhóm Backend chỉ cần implement đúng các hàm bên dưới theo
// path /api/v1/... là Frontend chạy được ngay, không cần sửa gì ở đây.
//
// Đang chạy ở chế độ MOCK (USE_MOCK = true): trả dữ liệu giả để bạn demo/
// dựng giao diện trước khi Backend xong. Khi Backend có API thật, đổi
// USE_MOCK = false và cấu hình NEXT_PUBLIC_API_BASE_URL trong file .env.local
// ============================================================================
import type { Application, ApplicationDocument, Candidate, SupervisorRequest } from "./types";

const USE_MOCK = true;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
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
  return request<{ accessToken: string }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken: googleIdToken }),
  });
}

export async function requestPasswordResetOtp(emailOrPhone: string) {
  if (USE_MOCK) return delay({ sent: true });
  return request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ emailOrPhone }) });
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
