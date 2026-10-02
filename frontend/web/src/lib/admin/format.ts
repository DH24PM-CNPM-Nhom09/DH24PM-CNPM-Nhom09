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
  VAN_BANG: "Văn bằng tốt nghiệp",
  BANG_DIEM: "Bảng điểm",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  DE_CUONG_NCS: "Đề cương nghiên cứu",
  THU_GIOI_THIEU: "Thư giới thiệu",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Giấy tờ khác",
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
};
