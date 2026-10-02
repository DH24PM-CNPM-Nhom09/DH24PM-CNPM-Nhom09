// Các kiểu dữ liệu dùng chung — đặt tên khớp đúng cột trong admission_db (v3)
// để Backend và Frontend nói cùng 1 "ngôn ngữ" khi ráp API thật.

export type ReviewStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_SUPPLEMENT"
  | "APPROVED"
  | "REJECTED";

export type AdmissionStatus =
  | "NONE"
  | "WAITLISTED"
  | "ADMITTED"
  | "CONFIRMED"
  | "ENROLLED";

export type DocumentType =
  | "VAN_BANG"
  | "BANG_DIEM"
  | "CHUNG_CHI_NGOAI_NGU"
  | "DE_CUONG_NCS"
  | "THU_GIOI_THIEU"
  | "CONG_BO_KHOA_HOC"
  | "KHAC";

export type SupervisorRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface Candidate {
  candidateId: number;
  fullName: string;
  dob: string;
  gender: "NAM" | "NU" | "KHAC" | null;
  idNumber: string | null; // CCCD/CMND
  address: string | null;
  email: string | null;
  phoneNumber: string | null;
  nationality?: string;
  accountCreatedAt?: string;
  hasPassword?: boolean;
}

export interface CandidateNotification {
  notificationId: number;
  title: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
}

/** Kết quả gửi mã xác thực. devOtp chỉ có khi backend CHƯA cấu hình gửi email (chế độ phát triển) */
export interface OtpSent {
  email?: string;
  emailSent?: boolean;
  expiresInMinutes?: number;
  resendAfterSeconds?: number;
  devOtp?: string;
}

export interface RegisterPayload {
  fullName: string;
  dob: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export interface Application {
  applicationId: number;
  applicationCode: string;
  reviewStatus: ReviewStatus;
  admissionStatus: AdmissionStatus;
  batchName: string;
  majorName: string;
  degreeLevel: "THAC_SI" | "TIEN_SI";
  submittedAt: string | null;
}

export interface ApplicationDocument {
  documentId: number;
  documentType: DocumentType;
  fileName: string;
  fileSizeKb: number;
  verifyStatus: "PENDING" | "VALID" | "INVALID";
  verifyNote?: string | null;
  uploadedAt?: string;
}

export type DegreeLevel = "THAC_SI" | "TIEN_SI";

/** Quá trình đào tạo khai trong hồ sơ (bảng application_education) */
export interface EducationInput {
  degreeLevel: "DAI_HOC" | "THAC_SI";
  institutionName: string;
  majorName: string;
  graduationYear: number;
  gpa: number | null;
  gpaScale: 4 | 10;
}

export interface ResearchProposalInput {
  researchTopic: string;
  researchField: string;
  preferredLecturerId: number | null;
}

export interface Lecturer {
  lecturerId: number;
  fullName: string;
  facultyName: string | null;
}

/** Toàn bộ hồ sơ xét tuyển của thí sinh (GET /applications/me/full), kể cả bản nháp */
export interface FullApplication {
  applicationId: number;
  applicationCode: string;
  reviewStatus: ReviewStatus;
  admissionStatus: AdmissionStatus;
  createdAt: string;
  submittedAt: string | null;
  degreeLevel: DegreeLevel;
  batch: { batchId: number; batchCode: string; batchName: string; status: string; registrationEndAt: string; examStartAt: string | null };
  major: { batchMajorId: number; majorCode: string; majorName: string; facultyName: string | null };
  education: (Omit<EducationInput, "gpaScale"> & { gpaScale: number }) | null;
  proposal: (ResearchProposalInput & { lecturerName: string | null; supervisorStatus: SupervisorRequestStatus | null }) | null;
  documents: ApplicationDocument[];
  requiredDocuments: DocumentType[];
  missingDocuments: DocumentType[];
  payment: {
    amount: number;
    status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "CANCELLED" | "EXPIRED";
    method: string;
    receiptNo: string | null;
    paidAt: string | null;
    transferContent: string;
    bank: { bankName: string; accountNo: string; accountName: string };
  } | null;
  supplement: { content: string; deadline: string } | null;
  history: { status: ReviewStatus; at: string; by: "CANDIDATE" | "STAFF" | "SYSTEM"; reason: string | null }[];
  /** Còn sửa được (nháp và đợt còn hạn nhận hồ sơ) */
  canEdit: boolean;
  fee: number;
}

export interface SupervisorRequest {
  requestId: number;
  lecturerName: string;
  facultyName: string;
  status: SupervisorRequestStatus;
  requestedAt: string;
}

// Dạng lỗi chuẩn nhóm đã chốt trong Checklist Bảo mật & Xử lý lỗi GĐ3
export interface ApiError {
  error_code: string;
  message: string;
  detail?: string;
}
