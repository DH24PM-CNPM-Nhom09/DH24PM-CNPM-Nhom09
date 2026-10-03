// Nhãn và tiện ích dùng chung cho các trang hồ sơ xét tuyển của thí sinh
import type { DocumentType, ReviewStatus } from "./types";

export const DOC_LABEL: Record<DocumentType, string> = {
  DON_DANG_KY: "Đơn đăng ký dự tuyển",
  SO_YEU_LY_LICH: "Sơ yếu lý lịch",
  LY_LICH_CHUYEN_MON: "Lý lịch chuyên môn",
  ANH_THE: "Ảnh 3x4",
  VAN_BANG: "Bằng tốt nghiệp đại học",
  BANG_DIEM: "Bảng điểm",
  CCCD: "Căn cước công dân",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  CHUNG_CHI_AI: "Chứng chỉ AI (trí tuệ nhân tạo)",
  DE_CUONG_NCS: "Đề cương nghiên cứu",
  THU_GIOI_THIEU: "Thư giới thiệu (nhà khoa học)",
  GIAY_GIOI_THIEU: "Giấy giới thiệu của cơ quan / giảng viên",
  GIAY_UU_TIEN: "Giấy xác nhận đối tượng ưu tiên",
  CONG_NHAN_VAN_BANG: "Công nhận văn bằng nước ngoài",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Giấy tờ khác",
};

/** Hướng dẫn từng loại — theo mục "Hồ sơ dự tuyển" của thông báo tuyển sinh */
export const DOC_HINT: Record<DocumentType, string> = {
  DON_DANG_KY: "In đơn từ hệ thống (nút “In đơn đăng ký”), ký tên rồi chụp hoặc scan tải lên.",
  SO_YEU_LY_LICH: "Có xác nhận của địa phương hoặc nơi đang công tác.",
  LY_LICH_CHUYEN_MON: "Thành tích, giải thưởng, kinh nghiệm công tác, dự án đã tham gia… kèm minh chứng (gộp chung một tệp PDF).",
  ANH_THE: "Ảnh chân dung 3x4, nền trắng hoặc xanh, chụp trong 6 tháng gần đây.",
  VAN_BANG: "Bản sao y công chứng (trong vòng 6 tháng). Đang chờ bằng thì nộp giấy chứng nhận tốt nghiệp tạm thời.",
  BANG_DIEM: "Bản sao y công chứng bảng điểm toàn khóa (trong vòng 6 tháng).",
  CCCD: "Bản sao y công chứng căn cước công dân (trong vòng 6 tháng), đủ hai mặt.",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ do cơ sở được Bộ GD&ĐT / ĐHQG-HCM công nhận cấp, còn hạn 2 năm tính đến ngày đăng ký dự tuyển.",
  CHUNG_CHI_AI: "Chứng chỉ, chứng nhận hoàn thành khóa học về trí tuệ nhân tạo (nếu có).",
  DE_CUONG_NCS: "Đề cương nghiên cứu theo mẫu của Trường.",
  THU_GIOI_THIEU: "Thư giới thiệu của nhà khoa học có chức danh hoặc học vị tiến sĩ.",
  GIAY_GIOI_THIEU: "Giấy giới thiệu của cơ quan đang công tác hoặc của giảng viên (nếu có).",
  GIAY_UU_TIEN: "Giấy tờ chứng minh thuộc đối tượng ưu tiên trong tuyển sinh (nếu có).",
  CONG_NHAN_VAN_BANG: "Bắt buộc nếu văn bằng do cơ sở giáo dục nước ngoài cấp.",
  CONG_BO_KHOA_HOC: "Bài báo, báo cáo khoa học đã công bố (nếu có).",
  KHAC: "Giấy tờ khác theo yêu cầu của đợt tuyển sinh.",
};

/** Lý do miễn đánh giá năng lực ngoại ngữ hay gặp (mục 7.2 thông báo) — thí sinh có thể ghi lý do khác */
export const EXEMPT_REASONS = [
  "Có bằng tốt nghiệp đại học trở lên ngành ngôn ngữ nước ngoài",
  "Có bằng tốt nghiệp đại học trở lên do cơ sở nước ngoài cấp hoặc chương trình học bằng ngoại ngữ",
];

export const LANGUAGE_OPTION_TEXT = {
  CERTIFICATE: { title: "Đã có chứng chỉ ngoại ngữ", desc: "Chứng chỉ đạt chuẩn đầu vào, còn hạn 2 năm tính đến ngày đăng ký. Tải chứng chỉ ở bước Minh chứng." },
  EXEMPT: { title: "Thuộc diện được miễn", desc: "Ví dụ có bằng đại học ngành ngôn ngữ nước ngoài, hoặc học đại học ở nước ngoài / bằng ngoại ngữ (mục 7.2 thông báo)." },
  TEST: { title: "Đăng ký dự thi đánh giá năng lực tiếng Anh", desc: "Do Trường Đại học Khoa học Xã hội và Nhân văn (ĐHQG-HCM) ra đề và tổ chức. Nộp thêm lệ phí thi." },
} as const;

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
