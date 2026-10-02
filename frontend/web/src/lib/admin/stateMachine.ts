// ============================================================================
// State machine của application.review_status — đúng sơ đồ trong
// Backend_ThietKeChiTiet_GD3.md mục 2.4 (M4 application-review):
//
//   SUBMITTED ──tiếp nhận──▶ UNDER_REVIEW ──đạt──▶ APPROVED
//                               │   ▲  └──không đạt──▶ REJECTED
//                     yêu cầu bổ sung  thí sinh bổ sung xong
//                               ▼   │
//                          NEEDS_SUPPLEMENT ──quá hạn bổ sung──▶ REJECTED
//
// FE dùng để quyết định nút nào được hiện; Backend (ReviewService) phải chặn
// lại y hệt — mọi chuyển trạng thái đều ghi 1 dòng application_status_history.
// ============================================================================
import type { AdminApplication, ReviewStatus } from "./types";

export type ReviewAction =
  | "START_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "REQUEST_SUPPLEMENT"
  | "REJECT_EXPIRED"
  | "SUPPLEMENT_RECEIVED"; // do THÍ SINH kích hoạt khi nộp bổ sung (mock có nút giả lập)

export const TRANSITIONS: Record<ReviewAction, { from: ReviewStatus; to: ReviewStatus }> = {
  START_REVIEW: { from: "SUBMITTED", to: "UNDER_REVIEW" },
  APPROVE: { from: "UNDER_REVIEW", to: "APPROVED" },
  REJECT: { from: "UNDER_REVIEW", to: "REJECTED" },
  REQUEST_SUPPLEMENT: { from: "UNDER_REVIEW", to: "NEEDS_SUPPLEMENT" },
  REJECT_EXPIRED: { from: "NEEDS_SUPPLEMENT", to: "REJECTED" },
  SUPPLEMENT_RECEIVED: { from: "NEEDS_SUPPLEMENT", to: "UNDER_REVIEW" },
};

export const ACTION_LABEL: Record<ReviewAction, string> = {
  START_REVIEW: "Tiếp nhận thẩm định",
  APPROVE: "Đạt thẩm định",
  REJECT: "Không đạt",
  REQUEST_SUPPLEMENT: "Yêu cầu bổ sung",
  REJECT_EXPIRED: "Từ chối do quá hạn bổ sung",
  SUPPLEMENT_RECEIVED: "Ghi nhận đã bổ sung",
};

export function activeSupplement(app: AdminApplication) {
  return app.supplements.find((s) => s.status === "PENDING") ?? null;
}

export function isSupplementOverdue(app: AdminApplication, now = Date.now()) {
  const s = activeSupplement(app);
  return !!s && new Date(s.deadline).getTime() < now;
}

/**
 * Trả về null nếu được phép thực hiện, ngược lại trả về câu giải thích vì sao
 * chưa được — để hiển thị ngay cạnh nút thay vì ẩn nút đi không lý do.
 */
export function blockReason(app: AdminApplication, action: ReviewAction, now = Date.now()): string | null {
  const t = TRANSITIONS[action];
  if (app.isCancelled) return "Thí sinh đã rút hồ sơ.";
  if (app.reviewStatus !== t.from) return "Không áp dụng ở trạng thái hiện tại.";

  if (action === "APPROVE") {
    if (app.payment?.gatewayStatus !== "SUCCESS") return "Thí sinh chưa hoàn tất lệ phí xét tuyển.";
    if (app.documents.length === 0) return "Hồ sơ chưa có minh chứng nào.";
    const notValid = app.documents.filter((d) => d.verifyStatus !== "VALID");
    if (notValid.length > 0) return `Còn ${notValid.length} minh chứng chưa được xác nhận hợp lệ.`;
  }
  if (action === "REQUEST_SUPPLEMENT") {
    // Không bắt buộc có minh chứng INVALID (có thể thiếu hẳn giấy tờ), nhưng
    // nội dung yêu cầu là bắt buộc — kiểm tra ở form.
  }
  if (action === "REJECT_EXPIRED" && !isSupplementOverdue(app, now)) {
    return "Yêu cầu bổ sung vẫn còn hạn.";
  }
  return null;
}

export function availableActions(app: AdminApplication): ReviewAction[] {
  return (Object.keys(TRANSITIONS) as ReviewAction[]).filter(
    (a) => TRANSITIONS[a].from === app.reviewStatus && a !== "SUPPLEMENT_RECEIVED",
  );
}

/** Các mốc chính để vẽ "lộ trình hồ sơ" trên trang chi tiết */
export const REVIEW_ROUTE: ReviewStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED"];
