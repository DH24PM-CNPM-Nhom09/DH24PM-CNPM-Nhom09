type Tone = "success" | "warning" | "danger" | "info" | "gray";

const tones: Record<Tone, string> = {
  success: "bg-success-50 text-success",
  warning: "bg-warning-50 text-warning",
  danger: "bg-danger-50 text-danger",
  info: "bg-info-50 text-info",
  gray: "bg-gray-100 text-gray-500",
};

export default function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Ánh xạ trực tiếp 2 trục trạng thái trong admission_db v3 sang tone hiển thị,
// để mọi nơi trong app dùng chung 1 cách tô màu — tránh mỗi màn tự đoán 1 kiểu.
export function reviewStatusTone(status: string): Tone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "NEEDS_SUPPLEMENT":
      return "warning";
    case "UNDER_REVIEW":
    case "SUBMITTED":
      return "info";
    default:
      return "gray";
  }
}

export function admissionStatusTone(status: string): Tone {
  switch (status) {
    case "ADMITTED":
    case "CONFIRMED":
    case "ENROLLED":
      return "success";
    case "WAITLISTED":
      return "warning";
    default:
      return "gray";
  }
}

export const reviewStatusLabel: Record<string, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Đã nộp",
  UNDER_REVIEW: "Đang thẩm định",
  NEEDS_SUPPLEMENT: "Chờ bổ sung",
  APPROVED: "Đạt thẩm định",
  REJECTED: "Không đạt",
};

export const admissionStatusLabel: Record<string, string> = {
  NONE: "Chưa có kết quả",
  WAITLISTED: "Dự bị",
  ADMITTED: "Trúng tuyển",
  CONFIRMED: "Đã xác nhận nhập học",
  ENROLLED: "Đã nhập học",
};
