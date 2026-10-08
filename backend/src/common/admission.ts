import type { Prisma } from "@prisma/client";

// ============================================================================
// Quy tắc dùng chung cho xét tuyển (M5), kết quả (M6), quyết định & nhập học (M7).
// ============================================================================

/** Hồ sơ được đưa vào xét tuyển: đã "Đạt" thẩm định, chưa rút, chưa xóa */
export const eligibleWhere = (batchMajorId: bigint): Prisma.applicationWhereInput => ({
  batch_major_id: batchMajorId,
  review_status: "APPROVED",
  is_cancelled: false,
  deleted_at: null,
});

/** Hồ sơ còn đang thẩm định (chưa kết luận) — chặn công bố điểm / xếp hạng */
export const PENDING_REVIEW = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"];

/** Đợt đã đóng đăng ký thì mới tổ chức xét tuyển */
export const SCORING_BATCH_STATUS = ["CLOSED", "IN_REVIEW"];

/** Điểm thành phần của thí sinh vắng mặt: lưu score = 0 kèm ghi chú này */
export const ABSENT_NOTE = "VANG_THI";

export const EXAM_FORMAT_VI: Record<string, string> = { XET_HO_SO: "Xét hồ sơ", PHONG_VAN: "Phỏng vấn / trình bày", THI_VIET: "Thi viết" };
export const RESULT_VI: Record<string, string> = { TRUNG_TUYEN: "Trúng tuyển", DU_BI: "Dự bị", KHONG_TRUNG_TUYEN: "Không trúng tuyển" };
export const ROLE_IN_COMMITTEE_VI: Record<string, string> = { CHU_TICH: "Chủ tịch", THU_KY: "Thư ký", UY_VIEN: "Ủy viên" };
export const CONFIRM_VI: Record<string, string> = { CHUA_XAC_NHAN: "Chưa xác nhận", DA_XAC_NHAN: "Đã xác nhận nhập học", TU_CHOI_QUA_HAN: "Từ chối / quá hạn" };

const VN_OFFSET = 7 * 3600_000;

/** Ngày giờ theo giờ Việt Nam để ghi vào thông báo */
export const vnTime = (d: Date) =>
  d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
export const vnDate = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

/** 17:00 (giờ Việt Nam) của ngày cách `from` n ngày — dùng làm hạn chót */
export function deadlineAfterDays(from: Date, days: number) {
  const v = new Date(from.getTime() + VN_OFFSET + days * 86_400_000);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), 17, 0, 0) - VN_OFFSET);
}

/**
 * Sinh lần lượt các mốc giờ phỏng vấn trong giờ hành chính (giờ Việt Nam):
 * sáng 7:30–11:30, chiều 13:30–17:00, nghỉ Chủ nhật. Mỗi lượt `minutes` phút.
 */
export function* workingSlots(start: Date, minutes: number): Generator<Date> {
  let t = start.getTime();
  for (;;) {
    const v = new Date(t + VN_OFFSET);
    const dayStart = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) - VN_OFFSET;
    const at = (h: number, m: number) => dayStart + (h * 60 + m) * 60_000;
    const hm = v.getUTCHours() * 60 + v.getUTCMinutes();
    if (v.getUTCDay() === 0) t = at(24 + 7, 30);
    else if (hm < 7 * 60 + 30) t = at(7, 30);
    else if (hm < 13 * 60 + 30 && hm + minutes > 11 * 60 + 30) t = at(13, 30);
    else if (hm + minutes > 17 * 60) t = at(24 + 7, 30);
    else {
      yield new Date(t);
      t += minutes * 60_000;
    }
  }
}

/** Tổng điểm có trọng số, làm tròn 2 chữ số (khớp thủ tục sp_recalc_application_total_score) */
export function weightedTotal(scores: { score: number; weight: number }[]) {
  return Math.round(scores.reduce((s, x) => s + x.score * x.weight, 0) * 100) / 100;
}

/** Nội dung chuyển khoản lệ phí phúc khảo: "PK" + mã hồ sơ bỏ dấu gạch */
export const appealTransferNote = (applicationCode: string) => ("PK" + applicationCode.replace(/[^A-Za-z0-9]/g, "")).slice(0, 25);

/**
 * Thay thế trigger #4 / stored procedure sp_recalc_application_total_score.
 * Filess.io (bản free) không cho tạo TRIGGER/PROCEDURE (cần SUPER), nên tính
 * lại total_score trong application code sau mỗi lần INSERT/UPDATE exam_score.
 * rank_order = 1 chỉ là giá trị khởi tạo; bước xếp hạng (UC-TT-02) sẽ gán lại.
 */
export async function recalcApplicationTotalScore(
  tx: { exam_score: { findMany: Function }; application_ranking: { upsert: Function } },
  applicationId: bigint,
) {
  const scores = await tx.exam_score.findMany({
    where: { application_id: applicationId },
    include: { exam_subject: { select: { weight: true } } },
  });
  const total =
    Math.round(
      scores.reduce((s: number, x: { score: unknown; exam_subject: { weight: unknown } }) => s + Number(x.score) * Number(x.exam_subject.weight), 0) * 100,
    ) / 100;
  await tx.application_ranking.upsert({
    where: { application_id: applicationId },
    create: { application_id: applicationId, total_score: total, rank_order: 1 },
    update: { total_score: total }, // number OK; Prisma coerce to Decimal
  });
  return total;
}

/** Map kết quả xét tuyển -> application.admission_status (thay trigger #5) */
export function admissionStatusFromResult(result: string): "ADMITTED" | "WAITLISTED" | "NONE" {
  if (result === "TRUNG_TUYEN") return "ADMITTED";
  if (result === "DU_BI") return "WAITLISTED";
  return "NONE";
}
