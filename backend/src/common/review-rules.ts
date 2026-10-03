// ============================================================================
// State machine application.review_status — Backend_ThietKeChiTiet_GD3 mục 2.4.
// Bản này là nơi QUYẾT ĐỊNH; frontend có bản sao chỉ để hiện/ẩn nút.
//
//   SUBMITTED ──tiếp nhận──▶ UNDER_REVIEW ──đạt──▶ APPROVED
//                               │   ▲  └──không đạt──▶ REJECTED
//                     yêu cầu bổ sung  thí sinh bổ sung xong
//                               ▼   │
//                          NEEDS_SUPPLEMENT ──quá hạn bổ sung──▶ REJECTED
// ============================================================================

export type ReviewStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_SUPPLEMENT" | "APPROVED" | "REJECTED";

export type ReviewAction = "START_REVIEW" | "APPROVE" | "REJECT" | "REQUEST_SUPPLEMENT" | "REJECT_EXPIRED" | "SUPPLEMENT_RECEIVED";

export const TRANSITIONS: Record<ReviewAction, { from: ReviewStatus; to: ReviewStatus }> = {
  START_REVIEW: { from: "SUBMITTED", to: "UNDER_REVIEW" },
  APPROVE: { from: "UNDER_REVIEW", to: "APPROVED" },
  REJECT: { from: "UNDER_REVIEW", to: "REJECTED" },
  REQUEST_SUPPLEMENT: { from: "UNDER_REVIEW", to: "NEEDS_SUPPLEMENT" },
  REJECT_EXPIRED: { from: "NEEDS_SUPPLEMENT", to: "REJECTED" },
  SUPPLEMENT_RECEIVED: { from: "NEEDS_SUPPLEMENT", to: "UNDER_REVIEW" },
};

/** Hành động cán bộ được gọi qua API (SUPPLEMENT_RECEIVED do thí sinh kích hoạt) */
export const STAFF_ACTIONS: ReviewAction[] = ["START_REVIEW", "APPROVE", "REJECT", "REQUEST_SUPPLEMENT", "REJECT_EXPIRED"];

export const REVIEW_VI: Record<ReviewStatus, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Chờ tiếp nhận",
  UNDER_REVIEW: "Đang thẩm định",
  NEEDS_SUPPLEMENT: "Chờ bổ sung",
  APPROVED: "Đạt",
  REJECTED: "Không đạt",
};

export interface ReviewFacts {
  reviewStatus: string;
  isCancelled: boolean;
  paid: boolean;
  docsTotal: number;
  docsValid: number;
  pendingSupplementDeadline: Date | null;
  /** Thí sinh đăng ký thi đánh giá năng lực tiếng Anh (không có chứng chỉ, không được miễn) */
  englishTestRequired?: boolean;
  /** Kết quả thi tiếng Anh: PENDING / PASSED / FAILED / ABSENT, null = chưa xếp phòng */
  englishTestResult?: string | null;
}

/** null = được phép; ngược lại là câu giải thích (cũng là message lỗi trả về) */
export function blockReason(f: ReviewFacts, action: ReviewAction, now = Date.now()): string | null {
  const t = TRANSITIONS[action];
  if (f.isCancelled) return "Thí sinh đã rút hồ sơ.";
  if (f.reviewStatus !== t.from) return "Không áp dụng ở trạng thái hiện tại của hồ sơ.";
  if (action === "APPROVE") {
    if (!f.paid) return "Thí sinh chưa hoàn tất lệ phí xét tuyển.";
    if (f.docsTotal === 0) return "Hồ sơ chưa có minh chứng nào.";
    if (f.docsValid < f.docsTotal) return `Còn ${f.docsTotal - f.docsValid} minh chứng chưa được xác nhận hợp lệ.`;
    if (f.englishTestRequired && f.englishTestResult !== "PASSED")
      return f.englishTestResult === "FAILED" || f.englishTestResult === "ABSENT"
        ? "Thí sinh không đạt / vắng kỳ thi đánh giá năng lực tiếng Anh nên chưa đáp ứng điều kiện ngoại ngữ."
        : "Thí sinh đăng ký thi đánh giá năng lực tiếng Anh nhưng chưa có kết quả Đạt.";
  }
  if (action === "REJECT_EXPIRED") {
    if (!f.pendingSupplementDeadline || f.pendingSupplementDeadline.getTime() >= now) return "Yêu cầu bổ sung vẫn còn hạn.";
  }
  return null;
}
