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
