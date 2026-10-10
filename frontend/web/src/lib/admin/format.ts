// Định dạng hiển thị dùng chung cho phân hệ Quản lý (giờ Việt Nam)
const TZ = "Asia/Ho_Chi_Minh";

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(v: number) {
  return v.toLocaleString("vi-VN") + " đ";
}

export function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} MB` : `${kb} KB`;
}

/** "3 ngày trước", "còn 2 ngày" … */
export function relativeDays(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  const days = Math.round(diff / 86_400_000);
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) {
    if (hours === 0) return "vừa xong";
    return hours > 0 ? `còn ${hours} giờ` : `${-hours} giờ trước`;
  }
  return days > 0 ? `còn ${days} ngày` : `${-days} ngày trước`;
}

/** Giá trị cho <input type="datetime-local"> theo giờ máy */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function errorMessage(e: unknown, fallback = "Đã có lỗi xảy ra, vui lòng thử lại.") {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

export const DOCUMENT_LABEL: Record<string, string> = {
  DON_DANG_KY: "Đơn đăng ký dự tuyển",
  SO_YEU_LY_LICH: "Sơ yếu lý lịch",
  LY_LICH_CHUYEN_MON: "Lý lịch chuyên môn",
  ANH_THE: "Ảnh 3x4",
  VAN_BANG: "Bằng tốt nghiệp",
  BANG_DIEM: "Bảng điểm",
  CCCD: "Căn cước công dân",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  CHUNG_CHI_AI: "Chứng chỉ AI",
  DE_CUONG_NCS: "Đề cương nghiên cứu",
  THU_GIOI_THIEU: "Thư giới thiệu (nhà khoa học)",
  GIAY_GIOI_THIEU: "Giấy giới thiệu cơ quan / giảng viên",
  GIAY_UU_TIEN: "Giấy xác nhận đối tượng ưu tiên",
  CONG_NHAN_VAN_BANG: "Công nhận văn bằng nước ngoài",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Giấy tờ khác",
};

export const LANGUAGE_OPTION_LABEL: Record<string, string> = {
  CERTIFICATE: "Đã có chứng chỉ ngoại ngữ đạt chuẩn",
  EXEMPT: "Thuộc diện miễn đánh giá năng lực ngoại ngữ",
  TEST: "Đăng ký dự thi đánh giá năng lực tiếng Anh",
};

export const DEGREE_LABEL: Record<string, string> = { THAC_SI: "Thạc sĩ", TIEN_SI: "Tiến sĩ" };

export const EXAM_FORMAT_LABEL: Record<string, string> = {
  THI_VIET: "Thi viết",
  PHONG_VAN: "Phỏng vấn",
  XET_HO_SO: "Xét hồ sơ",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "MoMo",
  VNPAY: "VNPay",
  KHAC: "Khác",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  STAFF_LOGIN: "Đăng nhập",
  STAFF_CREATE: "Cấp tài khoản",
  STAFF_ROLE_UPDATE: "Đổi vai trò",
  STAFF_LOCK: "Khóa tài khoản",
  STAFF_UNLOCK: "Mở khóa tài khoản",
  BATCH_CREATE: "Tạo đợt tuyển sinh",
  BATCH_STATUS_CHANGE: "Đổi trạng thái đợt",
  BATCH_MAJOR_ADD: "Thêm ngành vào đợt",
  BATCH_MAJOR_UPDATE: "Sửa chỉ tiêu / môn thi",
  BATCH_MAJOR_APPROVE: "Phê duyệt chỉ tiêu",
  DOCUMENT_VERIFY: "Kiểm tra minh chứng",
  APPLICATION_START_REVIEW: "Tiếp nhận hồ sơ",
  APPLICATION_APPROVE: "Hồ sơ đạt",
  APPLICATION_REJECT: "Hồ sơ không đạt",
  APPLICATION_REQUEST_SUPPLEMENT: "Yêu cầu bổ sung",
  APPLICATION_REJECT_EXPIRED: "Từ chối quá hạn bổ sung",
  SUPPLEMENT_SUBMIT: "Thí sinh nộp bổ sung",
  SUPPLEMENT_OVERDUE_SCAN: "Quét hạn bổ sung",
  APPEAL_RESOLVE: "Xử lý phúc khảo",
  EXAM_FINISHED: "Kết thúc thi",
  CANDIDATE_REGISTER: "Thí sinh đăng ký tài khoản",
  STAFF_PASSWORD_CHANGE: "Đổi mật khẩu",
  STAFF_UPDATE: "Sửa thông tin cán bộ",
  STAFF_OFFBOARD: "Cho nghỉ việc",
  STAFF_RESTORE: "Khôi phục tài khoản",
  STAFF_PASSWORD_RESET: "Cấp lại mật khẩu tạm",
  STAFF_LOGIN_LOCKED: "Tạm khóa do đăng nhập sai nhiều lần",
  COMPLAINT_SUBMIT: "Thí sinh gửi khiếu nại",
  ANNOUNCEMENT_CREATE: "Soạn thông báo",
  ANNOUNCEMENT_PUBLISH: "Đăng thông báo",
  ANNOUNCEMENT_PUBLISHED: "Đăng thông báo",
  ANNOUNCEMENT_UPDATE: "Sửa thông báo",
  ANNOUNCEMENT_ARCHIVED: "Gỡ thông báo",
  ANNOUNCEMENT_DRAFT: "Chuyển thông báo về nháp",
  CANDIDATE_LOCK: "Khóa tài khoản thí sinh",
  SUPERVISOR_REQUEST: "NCS đề nghị giảng viên hướng dẫn",
  ENGLISH_SESSION_CREATE: "Tạo phòng thi tiếng Anh",
  ENGLISH_SESSION_UPDATE: "Cập nhật phòng thi tiếng Anh",
  ENGLISH_ASSIGN: "Xếp phòng thi tiếng Anh",
  ENGLISH_MOVE: "Chuyển phòng thi tiếng Anh",
  ENGLISH_GRADE: "Nhập kết quả thi tiếng Anh",
  SUPERVISOR_ACCEPT: "Giảng viên đồng ý hướng dẫn",
  SUPERVISOR_REJECT: "Giảng viên từ chối hướng dẫn",
  LECTURER_CREATE: "Thêm giảng viên",
  LECTURER_UPDATE: "Cập nhật giảng viên",
  CANDIDATE_UNLOCK: "Mở khóa tài khoản thí sinh",
  CANDIDATE_EXPORT: "Xuất danh sách thí sinh",
  APPLICATION_DRAFT_CREATE: "Thí sinh tạo hồ sơ nháp",
  APPLICATION_DRAFT_CANCEL: "Thí sinh hủy hồ sơ nháp",
  APPLICATION_SUBMIT: "Thí sinh nộp hồ sơ",
  DOCUMENT_UPLOAD: "Thí sinh tải minh chứng",
  DOCUMENT_DELETE: "Thí sinh xóa minh chứng",
  PAYMENT_CONFIRM: "Xác nhận đã thu lệ phí",
  PAYMENT_SETTINGS_UPDATE: "Cập nhật lệ phí & tài khoản nhận",
  APPLICATION_LANGUAGE: "Thí sinh khai ngoại ngữ",
  APPLICATION_DECLARATION: "Thí sinh khai thông tin theo CCCD và cam kết",
  MAJOR_CREATE: "Thêm ngành đào tạo",
  MAJOR_UPDATE: "Sửa ngành đào tạo",
  COMMITTEE_CREATE: "Lập tiểu ban xét tuyển",
  COMMITTEE_UPDATE: "Sửa tiểu ban xét tuyển",
  INTERVIEW_SCHEDULE: "Xếp lịch phỏng vấn / trình bày",
  INTERVIEW_UPDATE: "Đổi lịch phỏng vấn / trình bày",
  SCORE_ENTER: "Nhập điểm xét tuyển",
  SCORES_PUBLISH: "Công bố điểm",
  APPEAL_CREATE: "Thí sinh nộp đơn phúc khảo",
  APPEAL_FEE_CONFIRM: "Xác nhận lệ phí phúc khảo",
  APPEAL_CLOSE_UNPAID: "Đóng đơn phúc khảo chưa nộp phí",
  RESULT_RANK: "Định điểm chuẩn và xếp hạng",
  RESULT_PROPOSE: "Hội đồng thông qua kết quả",
  RESULT_RETURN: "Lãnh đạo trả lại kết quả",
  RESULT_PUBLISH: "Phê duyệt và công bố kết quả",
  WAITLIST_PROMOTE: "Gọi thí sinh dự bị",
  DECISION_CREATE: "Lập dự thảo quyết định trúng tuyển",
  DECISION_UPDATE: "Sửa dự thảo quyết định",
  DECISION_SUBMIT: "Trình ký quyết định",
  DECISION_RETURN: "Trả lại dự thảo quyết định",
  DECISION_ISSUE: "Ký ban hành quyết định trúng tuyển",
  ENROLL_CONFIRM: "Thí sinh xác nhận nhập học",
  ENROLL_DECLINE: "Thí sinh từ chối nhập học",
  ENROLL_OVERDUE: "Xử lý quá hạn xác nhận nhập học",
  ORIGINALS_VERIFIED: "Đối chiếu bản chính",
  ORIGINALS_MISSING: "Yêu cầu bổ sung bản chính",
  ENROLL_COMPLETE: "Hoàn tất nhập học",
  COMPLAINT_ACCEPT: "Tiếp nhận khiếu nại",
  COMPLAINT_RESOLVE: "Giải quyết khiếu nại",
  COMPLAINT_REJECT: "Không chấp nhận khiếu nại",
};
