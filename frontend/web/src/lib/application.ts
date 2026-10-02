// Nhãn và tiện ích dùng chung cho các trang hồ sơ xét tuyển của thí sinh
import type { DocumentType, ReviewStatus } from "./types";

export const DOC_LABEL: Record<DocumentType, string> = {
  VAN_BANG: "Văn bằng tốt nghiệp",
  BANG_DIEM: "Bảng điểm",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  DE_CUONG_NCS: "Đề cương nghiên cứu",
  THU_GIOI_THIEU: "Thư giới thiệu",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Giấy tờ khác",
};

export const DOC_HINT: Record<DocumentType, string> = {
  VAN_BANG: "Bản scan bằng tốt nghiệp đại học (dự tuyển tiến sĩ: kèm bằng thạc sĩ nếu có).",
  BANG_DIEM: "Bảng điểm toàn khóa, có xác nhận của cơ sở đào tạo.",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ còn thời hạn theo yêu cầu của ngành (nếu có).",
  DE_CUONG_NCS: "Đề cương nghiên cứu theo mẫu của Trường.",
  THU_GIOI_THIEU: "Thư giới thiệu của nhà khoa học có chức danh hoặc học vị tiến sĩ.",
  CONG_BO_KHOA_HOC: "Bài báo, báo cáo khoa học đã công bố (nếu có).",
  KHAC: "Giấy tờ khác theo yêu cầu của đợt tuyển sinh.",
};

/** Loại giấy tờ không bắt buộc thí sinh có thể nộp thêm */
export const OPTIONAL_DOCS: DocumentType[] = ["CHUNG_CHI_NGOAI_NGU", "CONG_BO_KHOA_HOC", "KHAC"];

export const DEGREE_LABEL = { THAC_SI: "Thạc sĩ", TIEN_SI: "Tiến sĩ" } as const;
export const EDU_LABEL = { DAI_HOC: "Đại học", THAC_SI: "Thạc sĩ" } as const;

export const VERIFY_LABEL = {
  PENDING: { text: "Chờ kiểm tra", tone: "gray" as const },
  VALID: { text: "Hợp lệ", tone: "success" as const },
  INVALID: { text: "Không hợp lệ", tone: "danger" as const },
};

export const HISTORY_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Tạo hồ sơ nháp",
  SUBMITTED: "Nộp hồ sơ",
  UNDER_REVIEW: "Cán bộ tiếp nhận thẩm định",
  NEEDS_SUPPLEMENT: "Yêu cầu bổ sung minh chứng",
  APPROVED: "Đạt thẩm định hồ sơ",
  REJECTED: "Không đạt thẩm định hồ sơ",
};

export function fmtMoney(v: number) {
  return `${v.toLocaleString("vi-VN")} đ`;
}

export function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];
/** Kiểm tra sớm ở trình duyệt (backend kiểm tra lại cả chữ ký tệp) */
export function checkFile(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return "Chỉ nhận tệp PDF, JPG hoặc PNG.";
  if (file.size > 5 * 1024 * 1024) return "Tệp vượt quá 5MB, vui lòng chọn tệp khác hoặc nén lại.";
  if (file.size === 0) return "Tệp rỗng, vui lòng chọn tệp khác.";
  return null;
}
