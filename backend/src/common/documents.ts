// ============================================================================
// Loại minh chứng — theo mục "Hồ sơ dự tuyển" của Thông báo tuyển sinh thạc sĩ
// Trường ĐH An Giang (2025 đợt 1). Phải khớp CHECK của cột
// application_document.document_type (migration v8) và frontend lib/application.ts.
// ============================================================================
export type Degree = "THAC_SI" | "TIEN_SI";

export const DOC_LABEL: Record<string, string> = {
  DON_DANG_KY: "Đơn đăng ký dự tuyển",
  SO_YEU_LY_LICH: "Sơ yếu lý lịch",
  LY_LICH_CHUYEN_MON: "Lý lịch chuyên môn",
  ANH_THE: "Ảnh 3x4",
  VAN_BANG: "Bằng tốt nghiệp",
  BANG_DIEM: "Bảng điểm",
  CCCD: "Căn cước công dân",
  DE_CUONG_NCS: "Đề cương nghiên cứu",
  THU_GIOI_THIEU: "Thư giới thiệu (nhà khoa học)",
  GIAY_GIOI_THIEU: "Giấy giới thiệu của cơ quan / giảng viên",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  CHUNG_CHI_AI: "Chứng chỉ AI (trí tuệ nhân tạo)",
  GIAY_UU_TIEN: "Giấy xác nhận đối tượng ưu tiên",
  CONG_NHAN_VAN_BANG: "Công nhận văn bằng nước ngoài",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Giấy tờ khác",
};

export const DOC_TYPES = Object.keys(DOC_LABEL);

/** Hồ sơ bắt buộc theo bậc. Chứng chỉ ngoại ngữ thành bắt buộc khi thí sinh chọn "đã có chứng chỉ". */
const BASE_REQUIRED = ["DON_DANG_KY", "SO_YEU_LY_LICH", "LY_LICH_CHUYEN_MON", "ANH_THE", "VAN_BANG", "BANG_DIEM", "CCCD"];
export function requiredDocs(degree: Degree, languageOption: string | null | undefined): string[] {
  const list = degree === "TIEN_SI" ? [...BASE_REQUIRED, "DE_CUONG_NCS", "THU_GIOI_THIEU"] : [...BASE_REQUIRED];
  if (languageOption === "CERTIFICATE") list.push("CHUNG_CHI_NGOAI_NGU");
  return list;
}

/** Giấy tờ "nếu có" — thí sinh nộp thêm khi phù hợp */
export const OPTIONAL_DOCS = ["GIAY_GIOI_THIEU", "CHUNG_CHI_NGOAI_NGU", "CHUNG_CHI_AI", "GIAY_UU_TIEN", "CONG_NHAN_VAN_BANG", "CONG_BO_KHOA_HOC", "KHAC"];

export const LANGUAGE_OPTIONS = ["CERTIFICATE", "EXEMPT", "TEST"] as const;
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];
export const LANGUAGE_LABEL: Record<LanguageOption, string> = {
  CERTIFICATE: "Đã có chứng chỉ ngoại ngữ đạt chuẩn",
  EXEMPT: "Thuộc diện miễn đánh giá năng lực ngoại ngữ",
  TEST: "Đăng ký dự thi đánh giá năng lực tiếng Anh",
};
