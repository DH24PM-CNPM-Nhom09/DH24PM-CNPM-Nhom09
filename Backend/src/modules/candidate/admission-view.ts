import { ABSENT_NOTE, appealTransferNote, RESULT_VI, weightedTotal } from "../../common/admission";
import type { SystemConfigService } from "../../common/config.service";
import { id, iso, isoReq, ymd } from "../../common/util";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Phần "xét tuyển → trúng tuyển → nhập học" trên trang hồ sơ của thí sinh.
 * Chỉ trả về những gì đã công bố cho thí sinh (điểm sau khi công bố, kết quả sau khi lãnh đạo duyệt,
 * quyết định sau khi ký ban hành). null = hồ sơ chưa vào giai đoạn xét tuyển.
 */
export async function admissionView(prisma: PrismaService, config: SystemConfigService, applicationId: bigint) {
  const a = await prisma.application.findUnique({
    where: { application_id: applicationId },
    include: {
      admission_batch_major: { include: { admission_batch: true, admission_major: true, exam_subject: { orderBy: { subject_id: "asc" } }, admission_benchmark: true } },
      interview_schedule: { where: { status: { not: "CANCELLED" } }, orderBy: { schedule_id: "desc" }, take: 1, include: { admission_committee: true } },
      exam_score: { include: { score_appeal: { orderBy: { appeal_id: "desc" } } } },
      appeal_request: true,
      application_ranking: true,
      admission_result: true,
      waitlist: true,
      decision_application: { include: { admission_decision: true } },
      enrollment_confirmation: true,
      original_document_submission: true,
      enrollment_completion: true,
    },
  });
  if (!a || a.review_status !== "APPROVED") return null;
  const bm = a.admission_batch_major;
  const isPhd = bm.admission_batch.degree_level === "TIEN_SI";
  const now = Date.now();
  const iv = a.interview_schedule[0];

  // ---- điểm (chỉ khi đã công bố)
  let scores = null;
  if (bm.scores_published_at) {
    const items = bm.exam_subject.map((s) => {
      const x = a.exam_score.find((e) => e.subject_id === s.subject_id);
      const ap = x?.score_appeal[0];
      return {
        subjectId: id(s.subject_id),
        subjectName: s.subject_name,
        weight: Number(s.weight),
        score: x ? Number(x.score) : null,
        absent: x?.note === ABSENT_NOTE,
        appeal: ap ? { status: ap.status, oldScore: Number(ap.old_score), newScore: ap.new_score === null ? null : Number(ap.new_score), note: ap.resolution_note } : null,
      };
    });
    const complete = items.every((i) => i.score !== null);
    const req = a.appeal_request;
    const deadlineOk = !!bm.appeal_deadline && bm.appeal_deadline.getTime() >= now;
    scores = {
      publishedAt: isoReq(bm.scores_published_at),
      items,
      total: complete ? weightedTotal(items.map((i) => ({ score: i.score as number, weight: i.weight }))) : null,
      appealDeadline: iso(bm.appeal_deadline),
      canAppeal: deadlineOk && !req && items.some((i) => i.score !== null && !i.absent),
      appealFee: await config.int("FEE_APPEAL", 360_000),
      appeal: req
        ? {
            status: req.status,
            reason: req.reason,
            feeAmount: Number(req.fee_amount),
            paidAt: iso(req.paid_at),
            transferContent: appealTransferNote(a.application_code),
            createdAt: isoReq(req.created_at),
          }
        : null,
    };
  }

  // ---- kết quả (chỉ khi lãnh đạo đã phê duyệt & công bố)
  const r = a.admission_result;
  const result =
    r?.published_at
      ? {
          result: r.result,
          label: RESULT_VI[r.result],
          rank: a.application_ranking?.rank_order ?? null,
          total: a.application_ranking ? Number(a.application_ranking.total_score) : null,
          benchmark: bm.admission_benchmark ? Number(bm.admission_benchmark.benchmark_value) : null,
          quota: bm.quota,
          waitlistRank: a.waitlist?.rank_order ?? null,
          promoted: a.waitlist?.status === "PROMOTED",
          publishedAt: isoReq(r.published_at),
        }
      : null;

  // ---- quyết định & nhập học
  const dec = a.decision_application.map((x) => x.admission_decision).find((d) => d.status === "ISSUED");
  const c = a.enrollment_confirmation;
  const enrollment =
    dec && c
      ? {
          decisionNo: dec.decision_no,
          decisionDate: ymd(dec.decision_date),
          signedAt: iso(dec.signed_at),
          status: c.status,
          deadline: isoReq(c.deadline),
          confirmedAt: iso(c.confirmed_at),
          canConfirm: c.status === "CHUA_XAC_NHAN" && c.deadline.getTime() >= now,
          canDecline: (c.status === "CHUA_XAC_NHAN" && c.deadline.getTime() >= now) || (c.status === "DA_XAC_NHAN" && !a.enrollment_completion?.completed_at),
          originals: a.original_document_submission?.status ?? null,
          studentCode: a.enrollment_completion?.completed_at ? a.enrollment_completion.transfer_ref : null,
          completedAt: iso(a.enrollment_completion?.completed_at),
        }
      : null;

  return {
    interviewLabel: isPhd ? "Trình bày đề cương nghiên cứu" : "Phỏng vấn chuyên môn",
    hasInterview: bm.exam_subject.some((s) => s.exam_format === "PHONG_VAN"),
    interview: iv ? { scheduledAt: isoReq(iv.scheduled_at), location: iv.location_or_link, committeeName: iv.admission_committee.committee_name, status: iv.status } : null,
    scores,
    result,
    enrollment,
  };
}
