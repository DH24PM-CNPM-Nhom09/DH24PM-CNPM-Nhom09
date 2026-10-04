import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ABSENT_NOTE, eligibleWhere, PENDING_REVIEW, RESULT_VI, vnTime, weightedTotal } from "../../common/admission";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq, ymd } from "../../common/util";
import { PrismaService, type Tx } from "../../prisma/prisma.service";
import { ScoringService } from "./scoring.service";

/**
 * M6 — Xét trúng tuyển theo ngành (Backend_ThietKeChiTiet_GD3 mục 2.6, 3.4):
 *   Hội đồng định điểm chuẩn + xếp hạng (buildRanking + applyBenchmark) → thông qua (cấp 1)
 *   → Lãnh đạo phê duyệt (cấp 2) và công bố. Trả lại thì hội đồng xếp hạng / thông qua lại.
 * Kết quả: tổng điểm ≥ điểm chuẩn và trong chỉ tiêu → TRUNG_TUYEN; ≥ điểm chuẩn ngoài chỉ tiêu
 * → DU_BI (vào danh sách dự bị theo thứ hạng); còn lại hoặc vắng mặt → KHONG_TRUNG_TUYEN.
 * Đồng điểm: ưu tiên điểm hình thức có trọng số lớn nhất, rồi nộp hồ sơ sớm hơn.
 */
@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadBm(batchMajorId: number, db: Tx = this.prisma) {
    const bm = await db.admission_batch_major.findUnique({
      where: { batch_major_id: BigInt(batchMajorId) },
      include: { admission_batch: true, admission_major: true, exam_subject: { orderBy: { subject_id: "asc" } }, admission_benchmark: true },
    });
    if (!bm || bm.admission_batch.deleted_at) notFound("Không tìm thấy ngành trong đợt tuyển sinh.");
    return bm;
  }

  /** Những điều còn thiếu để được xếp hạng (rỗng = xếp hạng được) */
  private async blockers(bm: Awaited<ReturnType<ResultsService["loadBm"]>>, db: Tx = this.prisma) {
    const out: string[] = [];
    if (bm.admission_batch.status !== "IN_REVIEW") out.push("Đợt tuyển sinh chưa chuyển sang trạng thái “Xét kết quả” (trang Đợt tuyển sinh).");
    const pending = await db.application.count({ where: { batch_major_id: bm.batch_major_id, is_cancelled: false, deleted_at: null, review_status: { in: PENDING_REVIEW } } });
    if (pending) out.push(`Còn ${pending} hồ sơ chưa thẩm định xong.`);
    if (!bm.scores_published_at) out.push("Chưa công bố điểm xét tuyển cho thí sinh.");
    else if (bm.appeal_deadline && bm.appeal_deadline.getTime() > Date.now()) out.push(`Chưa hết hạn phúc khảo (${vnTime(bm.appeal_deadline)}).`);
    const openAppeals = await db.score_appeal.count({ where: { status: "PENDING", exam_score: { application: { batch_major_id: bm.batch_major_id } } } });
    if (openAppeals) out.push(`Còn ${openAppeals} đơn phúc khảo chưa kết luận.`);
    return out;
  }

  // ====================================================================== xem
  async overview(batchMajorId: number) {
    const bm = await this.loadBm(batchMajorId);
    const [apps, staff] = await Promise.all([
      this.prisma.application.findMany({
        where: { batch_major_id: bm.batch_major_id, deleted_at: null, OR: [eligibleWhere(bm.batch_major_id), { admission_result: { isNot: null } }] },
        include: { candidate: true, exam_score: true, application_ranking: true, admission_result: true, waitlist: true, enrollment_confirmation: true },
      }),
      this.prisma.staff_account.findMany({ select: { staff_account_id: true, full_name: true } }),
    ]);
    const names = Object.fromEntries(staff.map((s) => [id(s.staff_account_id), s.full_name]));
    const results = apps.map((a) => a.admission_result).filter((r): r is NonNullable<typeof r> => !!r);
    const stage = ScoringService.resultStage(results);
    const subjects = bm.exam_subject.map((s) => ({ subjectId: id(s.subject_id), subjectName: s.subject_name, weight: Number(s.weight) }));
    const rows = apps
      .map((a) => {
        const sc = Object.fromEntries(a.exam_score.map((s) => [id(s.subject_id), s.note === ABSENT_NOTE ? null : Number(s.score)]));
        const complete = subjects.every((s) => a.exam_score.some((x) => id(x.subject_id) === s.subjectId));
        return {
          applicationId: id(a.application_id),
          applicationCode: a.application_code,
          fullName: a.candidate.full_name,
          dob: ymd(a.candidate.dob),
          scores: sc,
          absent: a.exam_score.some((s) => s.note === ABSENT_NOTE),
          total: complete ? weightedTotal(subjects.map((s) => ({ score: Number(a.exam_score.find((x) => id(x.subject_id) === s.subjectId)!.score), weight: s.weight }))) : null,
          rank: a.admission_result ? (a.application_ranking?.rank_order ?? null) : null,
          result: a.admission_result?.result ?? null,
          resultLabel: a.admission_result ? RESULT_VI[a.admission_result.result] : null,
          waitlist: a.waitlist ? { rank: a.waitlist.rank_order, status: a.waitlist.status } : null,
          cancelled: a.is_cancelled,
          enrollment: a.enrollment_confirmation?.status ?? null,
        };
      })
      .sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9) || (y.total ?? -1) - (x.total ?? -1) || x.applicationCode.localeCompare(y.applicationCode));
    const first = results[0];
    return {
      batch: { batchId: id(bm.batch_id), batchCode: bm.admission_batch.batch_code, batchName: bm.admission_batch.batch_name, status: bm.admission_batch.status, degreeLevel: bm.admission_batch.degree_level },
      major: { batchMajorId: id(bm.batch_major_id), majorCode: bm.admission_major.major_code, majorName: bm.admission_major.major_name, quota: bm.quota },
      subjects,
      benchmark: bm.admission_benchmark ? Number(bm.admission_benchmark.benchmark_value) : null,
      benchmarkDecidedBy: bm.admission_benchmark?.decided_by_staff_id ? names[id(bm.admission_benchmark.decided_by_staff_id)] : null,
      stage,
      proposedBy: first?.approved_by_staff_id ? names[id(first.approved_by_staff_id)] : null,
      approvedBy: first?.approved_by_leader_id ? names[id(first.approved_by_leader_id)] : null,
      publishedAt: iso(results.find((r) => r.published_at)?.published_at),
      returnNote: bm.result_return_note,
      scoresPublishedAt: iso(bm.scores_published_at),
      appealDeadline: iso(bm.appeal_deadline),
      blockers: stage === "PUBLISHED" ? [] : await this.blockers(bm),
      rows,
      stats: {
        admitted: results.filter((r) => r.result === "TRUNG_TUYEN").length,
        waitlisted: results.filter((r) => r.result === "DU_BI").length,
        rejected: results.filter((r) => r.result === "KHONG_TRUNG_TUYEN").length,
      },
    };
  }

  // ====================================================================== điểm chuẩn + xếp hạng
  async rank(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const benchmark = Number(String(body.benchmark ?? "").replace(",", "."));
    if (!Number.isFinite(benchmark) || benchmark < 0 || benchmark > 10) fail("VALIDATION", "Điểm chuẩn từ 0 đến 10.");
    const bmVal = Math.round(benchmark * 100) / 100;
    return this.prisma.$transaction(
      async (tx) => {
        const bm = await this.loadBm(batchMajorId, tx);
        const existing = await tx.admission_result.findMany({ where: { application: { batch_major_id: bm.batch_major_id } } });
        if (existing.some((r) => r.published_at)) conflict("RESULTS_PUBLISHED", "Kết quả của ngành này đã công bố, không xếp hạng lại được.");
        const blocks = await this.blockers(bm, tx);
        if (blocks.length) fail("NOT_READY", blocks.join(" "), HttpStatus.CONFLICT);

        const apps = await tx.application.findMany({ where: eligibleWhere(bm.batch_major_id), include: { exam_score: true } });
        if (!apps.length) fail("NO_CANDIDATE", "Ngành này không có thí sinh nào để xếp hạng.", HttpStatus.CONFLICT);
        const subjects = bm.exam_subject;
        const main = [...subjects].sort((a, b) => Number(b.weight) - Number(a.weight))[0];
        const scored = apps.map((a) => {
          const get = (sid: bigint) => a.exam_score.find((x) => x.subject_id === sid);
          if (subjects.some((s) => !get(s.subject_id))) fail("SCORES_INCOMPLETE", `Hồ sơ ${a.application_code} chưa đủ điểm.`, HttpStatus.CONFLICT);
          return {
            a,
            absent: a.exam_score.some((s) => s.note === ABSENT_NOTE),
            total: weightedTotal(subjects.map((s) => ({ score: Number(get(s.subject_id)!.score), weight: Number(s.weight) }))),
            mainScore: Number(get(main.subject_id)!.score),
          };
        });
        scored.sort(
          (x, y) =>
            Number(x.absent) - Number(y.absent) ||
            y.total - x.total ||
            y.mainScore - x.mainScore ||
            (x.a.submitted_at?.getTime() ?? 0) - (y.a.submitted_at?.getTime() ?? 0) ||
            x.a.application_code.localeCompare(y.a.application_code),
        );

        // Điểm chuẩn
        await tx.admission_benchmark.upsert({
          where: { batch_major_id: bm.batch_major_id },
          create: { batch_major_id: bm.batch_major_id, benchmark_value: new Prisma.Decimal(bmVal.toFixed(2)), decided_by_staff_id: BigInt(me.staffAccountId) },
          update: { benchmark_value: new Prisma.Decimal(bmVal.toFixed(2)), decided_by_staff_id: BigInt(me.staffAccountId), decided_at: new Date() },
        });
        await tx.admission_batch_major.update({ where: { batch_major_id: bm.batch_major_id }, data: { benchmark_score: new Prisma.Decimal(bmVal.toFixed(2)), result_return_note: null } });
        // Danh sách dự bị / kết quả NHÁP được lập lại từ đầu (chưa công bố nên chưa ai được báo);
        // hồ sơ không còn trong diện xét (đã rút...) thì bỏ khỏi kết quả nháp
        await tx.waitlist.deleteMany({ where: { application: { batch_major_id: bm.batch_major_id } } });
        await tx.admission_result.deleteMany({ where: { application: { batch_major_id: bm.batch_major_id }, published_at: null, application_id: { notIn: apps.map((a) => a.application_id) } } });

        let admitted = 0;
        let waitRank = 0;
        let rankOrder = 0;
        for (const s of scored) {
          rankOrder++;
          const pass = !s.absent && s.total >= bmVal;
          const result = pass && admitted < bm.quota ? "TRUNG_TUYEN" : pass ? "DU_BI" : "KHONG_TRUNG_TUYEN";
          if (result === "TRUNG_TUYEN") admitted++;
          await tx.application_ranking.upsert({
            where: { application_id: s.a.application_id },
            create: { application_id: s.a.application_id, total_score: new Prisma.Decimal(s.total.toFixed(2)), rank_order: rankOrder },
            update: { total_score: new Prisma.Decimal(s.total.toFixed(2)), rank_order: rankOrder },
          });
          // Kết quả nháp: chưa ai duyệt, chưa công bố
          await tx.admission_result.upsert({
            where: { application_id: s.a.application_id },
            create: { application_id: s.a.application_id, result },
            update: { result, approved_by_staff_id: null, approved_by_leader_id: null, approved_at: null, published_at: null },
          });
          if (result === "DU_BI") await tx.waitlist.create({ data: { application_id: s.a.application_id, rank_order: ++waitRank } });
        }
        await this.audit.record(
          { type: "STAFF", id: me.staffAccountId },
          "RESULT_RANK",
          { table: "admission_benchmark", id: bm.batch_major_id },
          `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: điểm chuẩn ${bmVal}, chỉ tiêu ${bm.quota} → ${admitted} trúng tuyển, ${waitRank} dự bị, ${scored.length - admitted - waitRank} không trúng tuyển`,
          tx,
        );
        return { admitted, waitlisted: waitRank, rejected: scored.length - admitted - waitRank };
      },
      { timeout: 60_000 },
    );
  }

  // ====================================================================== duyệt 2 cấp
  async propose(me: StaffUser, batchMajorId: number) {
    const bm = await this.loadBm(batchMajorId);
    const results = await this.prisma.admission_result.findMany({ where: { application: { batch_major_id: bm.batch_major_id } } });
    const stage = ScoringService.resultStage(results);
    if (stage === "NOT_RANKED") fail("NOT_RANKED", "Chưa xếp hạng. Nhập điểm chuẩn và bấm “Xếp hạng” trước.", HttpStatus.CONFLICT);
    if (stage !== "DRAFT") conflict("INVALID_STATE", stage === "PUBLISHED" ? "Kết quả đã công bố." : "Kết quả đã được hội đồng thông qua, đang chờ lãnh đạo phê duyệt.");
    // Có thể đã thay đổi sau khi xếp hạng (hồ sơ bị rút...) -> bắt xếp hạng lại
    const eligible = await this.prisma.application.count({ where: eligibleWhere(bm.batch_major_id) });
    if (eligible !== results.length) fail("STALE_RANKING", "Danh sách thí sinh đã thay đổi sau lần xếp hạng. Bấm “Xếp hạng” lại.", HttpStatus.CONFLICT);
    await this.prisma.$transaction(async (tx) => {
      await tx.admission_result.updateMany({ where: { application_id: { in: results.map((r) => r.application_id) }, published_at: null }, data: { approved_by_staff_id: BigInt(me.staffAccountId) } });
      await tx.admission_batch_major.update({ where: { batch_major_id: bm.batch_major_id }, data: { result_return_note: null } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "RESULT_PROPOSE", { table: "admission_result", id: null }, `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: hội đồng thông qua kết quả xét tuyển (cấp 1), trình lãnh đạo`, tx);
    });
    return { success: true };
  }

  async returnResults(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const note = String(body.note ?? "").trim();
    if (note.length < 10) fail("VALIDATION", "Ghi rõ lý do trả lại (ít nhất 10 ký tự).");
    const bm = await this.loadBm(batchMajorId);
    const results = await this.prisma.admission_result.findMany({ where: { application: { batch_major_id: bm.batch_major_id } } });
    if (ScoringService.resultStage(results) !== "PROPOSED") conflict("INVALID_STATE", "Chỉ trả lại kết quả đang chờ lãnh đạo phê duyệt.");
    await this.prisma.$transaction(async (tx) => {
      await tx.admission_result.updateMany({ where: { application_id: { in: results.map((r) => r.application_id) }, published_at: null }, data: { approved_by_staff_id: null } });
      await tx.admission_batch_major.update({ where: { batch_major_id: bm.batch_major_id }, data: { result_return_note: note.slice(0, 500) } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "RESULT_RETURN", { table: "admission_result", id: null }, `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: lãnh đạo trả lại kết quả — ${note}`, tx);
    });
    return { success: true };
  }

  async approve(me: StaffUser, batchMajorId: number) {
    const bm = await this.loadBm(batchMajorId);
    return this.prisma.$transaction(
      async (tx) => {
        const results = await tx.admission_result.findMany({
          where: { application: { batch_major_id: bm.batch_major_id } },
          include: { application: { include: { application_ranking: true, waitlist: true } } },
        });
        const stage = ScoringService.resultStage(results);
        if (stage !== "PROPOSED") conflict("INVALID_STATE", stage === "PUBLISHED" ? "Kết quả đã công bố." : "Kết quả chưa được hội đồng thông qua.");
        if (results.some((r) => r.approved_by_staff_id === BigInt(me.staffAccountId)))
          fail("SAME_APPROVER", "Người thông qua cấp 1 không được phê duyệt cấp 2 cho cùng kết quả.", HttpStatus.FORBIDDEN);
        const now = new Date();
        // Đủ 2 chữ ký mới set published_at -> trigger #5 đồng bộ application.admission_status
        // Lọc theo danh sách id (không lọc qua bảng application): trigger #5 cập nhật bảng application,
        // MariaDB không cho trigger sửa bảng mà chính câu lệnh đang đọc (lỗi 1442)
        await tx.admission_result.updateMany({
          where: { application_id: { in: results.map((r) => r.application_id) }, published_at: null },
          data: { approved_by_leader_id: BigInt(me.staffAccountId), approved_at: now, published_at: now },
        });
        const bmVal = bm.admission_benchmark ? Number(bm.admission_benchmark.benchmark_value) : null;
        for (const r of results) {
          const a = r.application;
          const total = a.application_ranking ? Number(a.application_ranking.total_score) : null;
          const msg =
            r.result === "TRUNG_TUYEN"
              ? `Chúc mừng! Bạn đã TRÚNG TUYỂN ngành ${bm.admission_major.major_name} (${bm.admission_batch.batch_name}) với tổng điểm ${total}. Quyết định công nhận trúng tuyển và hướng dẫn xác nhận nhập học sẽ được gửi trên cổng thí sinh.`
              : r.result === "DU_BI"
                ? `Bạn có tên trong DANH SÁCH DỰ BỊ ngành ${bm.admission_major.major_name}, thứ tự ${a.waitlist?.rank_order ?? "?"} (tổng điểm ${total}). Nếu có thí sinh trúng tuyển không nhập học, Nhà trường sẽ gọi bổ sung theo thứ tự dự bị.`
                : `Rất tiếc, bạn không trúng tuyển ngành ${bm.admission_major.major_name} (tổng điểm ${total}${bmVal !== null ? `, điểm chuẩn ${bmVal}` : ""}). Cảm ơn bạn đã quan tâm tuyển sinh sau đại học của Trường.`;
          await this.audit.notifyCandidate(id(a.candidate_id), `Kết quả xét tuyển: ${RESULT_VI[r.result]}`, `Hồ sơ ${a.application_code}. ${msg}`, tx);
        }
        await this.audit.record(
          { type: "STAFF", id: me.staffAccountId },
          "RESULT_PUBLISH",
          { table: "admission_result", id: null },
          `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: lãnh đạo phê duyệt (cấp 2) và công bố kết quả — ${results.filter((r) => r.result === "TRUNG_TUYEN").length} trúng tuyển, ${results.filter((r) => r.result === "DU_BI").length} dự bị`,
          tx,
        );
        return { success: true, publishedAt: isoReq(now) };
      },
      { timeout: 60_000 },
    );
  }

  // ====================================================================== gọi dự bị
  /**
   * Bù chỗ trống chỉ tiêu bằng thí sinh dự bị (theo thứ tự). Gọi trong transaction của
   * thao tác làm phát sinh chỗ trống (thí sinh từ chối / quá hạn xác nhận nhập học).
   */
  async promoteFromWaitlist(tx: Tx, batchMajorId: bigint, actor: { type: "STAFF" | "CANDIDATE" | "SYSTEM"; id: number | null }): Promise<string[]> {
    const bm = await tx.admission_batch_major.findUniqueOrThrow({ where: { batch_major_id: batchMajorId }, include: { admission_major: true, admission_batch: true } });
    const holding = await tx.admission_result.count({
      where: { result: "TRUNG_TUYEN", published_at: { not: null }, application: { batch_major_id: batchMajorId, is_cancelled: false } },
    });
    let gap = bm.quota - holding;
    const promoted: string[] = [];
    if (gap <= 0) return promoted;
    const queue = await tx.waitlist.findMany({
      where: { status: "WAITING", application: { batch_major_id: batchMajorId, is_cancelled: false } },
      orderBy: { rank_order: "asc" },
      include: { application: true },
    });
    for (const w of queue) {
      if (gap <= 0) break;
      await tx.waitlist.update({ where: { waitlist_id: w.waitlist_id }, data: { status: "PROMOTED" } });
      // Đổi DU_BI -> TRUNG_TUYEN trên kết quả đã công bố -> trigger #5 đặt admission_status = ADMITTED
      await tx.admission_result.update({ where: { application_id: w.application_id }, data: { result: "TRUNG_TUYEN" } });
      await this.audit.notifyCandidate(
        id(w.application.candidate_id),
        "Kết quả xét tuyển: Trúng tuyển (gọi từ danh sách dự bị)",
        `Hồ sơ ${w.application.application_code}: do có thí sinh không nhập học, bạn được gọi TRÚNG TUYỂN bổ sung ngành ${bm.admission_major.major_name} theo thứ tự dự bị ${w.rank_order}. Quyết định trúng tuyển bổ sung và hướng dẫn xác nhận nhập học sẽ được gửi trên cổng thí sinh.`,
        tx,
      );
      promoted.push(w.application.application_code);
      gap--;
    }
    if (promoted.length)
      await this.audit.record(actor, "WAITLIST_PROMOTE", { table: "waitlist", id: null }, `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: gọi dự bị trúng tuyển ${promoted.join(", ")}`, tx);
    return promoted;
  }
}
