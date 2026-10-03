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
  | "DON_DANG_KY"
  | "SO_YEU_LY_LICH"
  | "LY_LICH_CHUYEN_MON"
  | "ANH_THE"
  | "VAN_BANG"
  | "BANG_DIEM"
  | "CCCD"
  | "CHUNG_CHI_NGOAI_NGU"
  | "CHUNG_CHI_AI"
  | "DE_CUONG_NCS"
  | "THU_GIOI_THIEU"
  | "GIAY_GIOI_THIEU"
  | "GIAY_UU_TIEN"
  | "CONG_NHAN_VAN_BANG"
  | "CONG_BO_KHOA_HOC"
  | "KHAC";

export type LanguageOption = "CERTIFICATE" | "EXEMPT" | "TEST";
export interface FeeItem {
  code: string;
  label: string;
  amount: number;
}

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
  optionalDocuments: DocumentType[];
  missingDocuments: DocumentType[];
  language: { option: LanguageOption | null; note: string | null; requiredLevel: string };
  /** Thi đánh giá năng lực tiếng Anh — chỉ có khi thí sinh chọn đăng ký dự thi (null = không phải thi) */
  englishTest: {
    candidateNumber: string | null;
    seatNo: number | null;
    sessionCode: string | null;
    testAt: string | null;
    room: string | null;
    location: string | null;
    note: string | null;
    result: EnglishTestResult | null;
    score: number | null;
  } | null;
  payment: {
    amount: number;
    status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "CANCELLED" | "EXPIRED";
    method: string;
    receiptNo: string | null;
    paidAt: string | null;
    transferContent: string;
    bank: { bankBin?: string; bankName: string; accountNo: string; accountName: string };
  } | null;
  supplement: { content: string; deadline: string } | null;
  history: { status: ReviewStatus; at: string; by: "CANDIDATE" | "STAFF" | "SYSTEM"; reason: string | null }[];
  /** Còn sửa được (nháp và đợt còn hạn nhận hồ sơ) */
  canEdit: boolean;
  /** Tổng tiền phải nộp khi nộp hồ sơ = tổng feeItems */
  fee: number;
  feeItems: FeeItem[];
  /** Các khoản có thể phát sinh sau: học bổ sung kiến thức (đ/tín chỉ), phúc khảo hồ sơ */
  otherFees: { supplementCredit: number; appeal: number; englishTest: number };
  /** Xét tuyển → kết quả → quyết định → nhập học (chỉ phần đã công bố). null = chưa vào giai đoạn xét tuyển */
  admission?: AdmissionView | null;
  /** Hồ sơ đã hủy do thí sinh từ chối / quá hạn xác nhận nhập học */
  declined?: boolean;
}

export type AdmissionResultCode = "TRUNG_TUYEN" | "DU_BI" | "KHONG_TRUNG_TUYEN";
export interface AdmissionView {
  interviewLabel: string;
  hasInterview: boolean;
  interview: { scheduledAt: string; location: string | null; committeeName: string; status: string } | null;
  scores: {
    publishedAt: string;
    items: {
      subjectId: number;
      subjectName: string;
      weight: number;
      score: number | null;
      absent: boolean;
      appeal: { status: "PENDING" | "RESOLVED_CHANGED" | "RESOLVED_UNCHANGED"; oldScore: number; newScore: number | null; note: string | null } | null;
    }[];
    total: number | null;
    appealDeadline: string | null;
    canAppeal: boolean;
    appealFee: number;
    appeal: { status: "CHO_NOP_PHI" | "DA_NOP_PHI" | "DONG"; reason: string; feeAmount: number; paidAt: string | null; transferContent: string; createdAt: string } | null;
  } | null;
  result: {
    result: AdmissionResultCode;
    label: string;
    rank: number | null;
    total: number | null;
    benchmark: number | null;
    quota: number;
    waitlistRank: number | null;
    promoted: boolean;
    publishedAt: string;
  } | null;
  enrollment: {
    decisionNo: string | null;
    decisionDate: string | null;
    signedAt: string | null;
    status: "CHUA_XAC_NHAN" | "DA_XAC_NHAN" | "TU_CHOI_QUA_HAN";
    deadline: string;
    confirmedAt: string | null;
    canConfirm: boolean;
    canDecline: boolean;
    originals: "PENDING" | "VERIFIED" | "MISSING" | null;
    studentCode: string | null;
    completedAt: string | null;
  } | null;
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

/** Trang "Giảng viên hướng dẫn" của thí sinh (GET /supervisors/me) */
export interface SupervisorRequestItem {
  requestId: number;
  lecturerId: number;
  lecturerName: string;
  facultyName: string;
  status: SupervisorRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  responseNote: string | null;
}
export type SupervisorOverview =
  | { state: "NO_APPLICATION" }
  | { state: "MASTER"; applicationCode: string; reviewStatus: ReviewStatus; degreeLevel: "THAC_SI"; majorName: string }
  | { state: "DRAFT"; applicationCode: string; reviewStatus: ReviewStatus; degreeLevel: "TIEN_SI"; majorName: string }
  | {
      state: "DOCTORAL";
      applicationCode: string;
      reviewStatus: ReviewStatus;
      degreeLevel: "TIEN_SI";
      majorName: string;
      researchTopic: string | null;
      researchField: string | null;
      requests: SupervisorRequestItem[];
      canRequest: boolean;
      remaining: number;
    };

export type EnglishTestResult = "PENDING" | "PASSED" | "FAILED" | "ABSENT";
