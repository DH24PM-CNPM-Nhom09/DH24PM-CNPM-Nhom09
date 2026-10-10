import { HttpStatus, Injectable } from "@nestjs/common";
import { deadlineAfterDays, vnDate, vnTime } from "../../common/admission";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { SystemConfigService } from "../../common/config.service";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq, ymd } from "../../common/util";
import { PrismaService, type Tx } from "../../prisma/prisma.service";
import { ResultsService } from "./results.service";

const DECISION_VI: Record<string, string> = { DRAFT: "Dự thảo", PENDING_SIGN: "Chờ ký", SIGNED: "Đã ký", FAILED_SIGN: "Bị trả lại", ISSUED: "Đã ban hành" };

/**
 * M7 — Quyết định trúng tuyển và nhập học (Backend_ThietKeChiTiet_GD3 mục 2.7, 3.5):
 *   Cán bộ lập dự thảo quyết định (gồm thí sinh trúng tuyển đã công bố, chưa thuộc quyết định nào)
 *   → trình ký → Lãnh đạo ký ban hành (trigger #8) → thí sinh xác nhận nhập học trong hạn (trigger #6)
 *   → nộp bản chính, cán bộ đối chiếu → hoàn tất nhập học, cấp mã học viên (trigger #7).
 *   Thí sinh từ chối / quá hạn → hủy chỗ và gọi dự bị (promoteFromWaitlist).
 */
@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly results: ResultsService,
  ) {}

  /** Thí sinh trúng tuyển đã công bố, còn hiệu lực, chưa có trong quyết định nào */
  private pendingWhere(batchId: bigint) {
    return {
      deleted_at: null,
      is_cancelled: false,
      admission_batch_major: { batch_id: batchId },
      admission_result: { is: { result: "TRUNG_TUYEN", published_at: { not: null } } },
      decision_application: { none: {} },
    };
  }

  // ====================================================================== tổng quan đợt
  async overview(batchId: number) {
    const b = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!b) notFound("Không tìm thấy đợt tuyển sinh.");
    const [decisions, pending, admitted, waitlist, staff] = await Promise.all([
      this.prisma.admission_decision.findMany({ where: { batch_id: b.batch_id }, orderBy: { decision_id: "asc" }, include: { _count: { select: { decision_application: true } } } }),
      this.prisma.application.findMany({ where: this.pendingWhere(b.batch_id), orderBy: { application_code: "asc" }, include: { candidate: true, admission_batch_major: { include: { admission_major: true } } } }),
      this.prisma.application.findMany({
        where: { deleted_at: null, admission_batch_major: { batch_id: b.batch_id }, decision_application: { some: {} } },
        orderBy: { application_code: "asc" },
        include: {
          candidate: true,
          admission_batch_major: { include: { admission_major: true } },
          decision_application: { include: { admission_decision: true } },
          enrollment_confirmation: true,
          original_document_submission: true,
          enrollment_completion: true,
          waitlist: true,
        },
      }),
      this.prisma.waitlist.findMany({
        where: { application: { admission_batch_major: { batch_id: b.batch_id }, admission_result: { is: { published_at: { not: null } } } } },
        orderBy: [{ application: { batch_major_id: "asc" } }, { rank_order: "asc" }],
        include: { application: { include: { candidate: true, admission_batch_major: { include: { admission_major: true } } } } },
      }),
      this.prisma.staff_account.findMany({ select: { staff_account_id: true, full_name: true } }),
    ]);
    const names = Object.fromEntries(staff.map((s) => [id(s.staff_account_id), s.full_name]));
    const now = Date.now();
    const rows = admitted.map((a) => {
      const d = a.decision_application[0]?.admission_decision;
      const c = a.enrollment_confirmation;
      return {
        applicationId: id(a.application_id),
        applicationCode: a.application_code,
        fullName: a.candidate.full_name,
        dob: ymd(a.candidate.dob),
        majorName: a.admission_batch_major.admission_major.major_name,
        fromWaitlist: a.waitlist?.status === "PROMOTED",
        decisionNo: d?.decision_no ?? null,
        decisionStatus: d?.status ?? null,
        confirmation: c ? { status: c.status, deadline: isoReq(c.deadline), confirmedAt: iso(c.confirmed_at), overdue: c.status === "CHUA_XAC_NHAN" && c.deadline.getTime() < now } : null,
        originals: a.original_document_submission ? { status: a.original_document_submission.status, verifiedAt: iso(a.original_document_submission.verified_at) } : null,
        completion: a.enrollment_completion?.completed_at ? { transferRef: a.enrollment_completion.transfer_ref, completedAt: isoReq(a.enrollment_completion.completed_at) } : null,
      };
    });
    return {
      batch: { batchId: id(b.batch_id), batchCode: b.batch_code, batchName: b.batch_name, status: b.status, degreeLevel: b.degree_level },
      decisions: decisions.map((d) => ({
        decisionId: id(d.decision_id),
        decisionNo: d.decision_no,
        decisionDate: ymd(d.decision_date),
        status: d.status,
        statusLabel: DECISION_VI[d.status] ?? d.status,
        signedBy: d.signed_by_staff_id ? names[id(d.signed_by_staff_id)] : null,
        signedAt: iso(d.signed_at),
        returnNote: d.return_note,
        count: d._count.decision_application,
      })),
      pending: pending.map((a) => ({ applicationId: id(a.application_id), applicationCode: a.application_code, fullName: a.candidate.full_name, majorName: a.admission_batch_major.admission_major.major_name })),
      admitted: rows,
      waitlist: waitlist.map((w) => ({
        applicationCode: w.application.application_code,
        fullName: w.application.candidate.full_name,
        majorName: w.application.admission_batch_major.admission_major.major_name,
        rank: w.rank_order,
        status: w.status,
      })),
      stats: {
        admitted: rows.length,
        confirmed: rows.filter((r) => r.confirmation?.status === "DA_XAC_NHAN").length,
        waiting: rows.filter((r) => r.confirmation?.status === "CHUA_XAC_NHAN").length,
        declined: rows.filter((r) => r.confirmation?.status === "TU_CHOI_QUA_HAN").length,
        overdue: rows.filter((r) => r.confirmation?.overdue).length,
        enrolled: rows.filter((r) => r.completion).length,
      },
    };
  }

  // ====================================================================== quyết định
  private readDecision(body: Record<string, unknown>) {
    const decisionNo = String(body.decisionNo ?? "").trim().replace(/\s+/g, " ");
    const dateRaw = String(body.decisionDate ?? "").trim();
    const decisionDate = new Date(`${dateRaw}T00:00:00Z`);
    if (decisionNo.length < 3 || decisionNo.length > 50) fail("VALIDATION", "Nhập số quyết định (ví dụ 1234/QĐ-ĐHAG).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw) || Number.isNaN(decisionDate.getTime())) fail("VALIDATION", "Chọn ngày quyết định.");
    return { decisionNo, decisionDate };
  }

  async createDecision(me: StaffUser, batchId: number, body: Record<string, unknown>) {
    const b = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!b) notFound("Không tìm thấy đợt tuyển sinh.");
    const d = this.readDecision(body);
    if (await this.prisma.admission_decision.count({ where: { decision_no: d.decisionNo } })) conflict("DUPLICATE", `Số quyết định ${d.decisionNo} đã được dùng.`);
    return this.prisma.$transaction(async (tx) => {
      const apps = await tx.application.findMany({ where: this.pendingWhere(b.batch_id), select: { application_id: true } });
      if (!apps.length) fail("NO_CANDIDATE", "Không có thí sinh trúng tuyển nào chưa có quyết định. Kết quả xét tuyển phải được lãnh đạo phê duyệt và công bố trước.", HttpStatus.CONFLICT);
      const dec = await tx.admission_decision.create({ data: { batch_id: b.batch_id, decision_no: d.decisionNo, decision_date: d.decisionDate, status: "DRAFT" } });
      await tx.decision_application.createMany({ data: apps.map((a) => ({ decision_id: dec.decision_id, application_id: a.application_id })) });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "DECISION_CREATE", { table: "admission_decision", id: dec.decision_id }, `${b.batch_code}: lập dự thảo quyết định ${d.decisionNo} gồm ${apps.length} thí sinh trúng tuyển`, tx);
      return { decisionId: id(dec.decision_id), count: apps.length };
    });
  }

  private async loadDecision(decisionId: number, db: Tx = this.prisma) {
    const d = await db.admission_decision.findUnique({ where: { decision_id: BigInt(decisionId) }, include: { admission_batch: true } });
    if (!d) notFound("Không tìm thấy quyết định.");
    return d;
  }

  async updateDecision(me: StaffUser, decisionId: number, body: Record<string, unknown>) {
    const d = await this.loadDecision(decisionId);
    if (!["DRAFT", "FAILED_SIGN"].includes(d.status)) conflict("INVALID_STATE", "Chỉ sửa được dự thảo chưa trình ký.");
    const v = this.readDecision(body);
    if (v.decisionNo !== d.decision_no && (await this.prisma.admission_decision.count({ where: { decision_no: v.decisionNo } }))) conflict("DUPLICATE", `Số quyết định ${v.decisionNo} đã được dùng.`);
    await this.prisma.$transaction(async (tx) => {
      // Bổ sung thí sinh trúng tuyển mới phát sinh (ví dụ gọi dự bị) vào dự thảo
      const more = await tx.application.findMany({ where: this.pendingWhere(d.batch_id), select: { application_id: true } });
      if (more.length) await tx.decision_application.createMany({ data: more.map((a) => ({ decision_id: d.decision_id, application_id: a.application_id })) });
      await tx.admission_decision.update({ where: { decision_id: d.decision_id }, data: { decision_no: v.decisionNo, decision_date: v.decisionDate } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "DECISION_UPDATE", { table: "admission_decision", id: d.decision_id }, `Sửa dự thảo quyết định ${v.decisionNo}${more.length ? `, bổ sung ${more.length} thí sinh` : ""}`, tx);
    });
    return { success: true };
  }

  async submitDecision(me: StaffUser, decisionId: number) {
    const d = await this.loadDecision(decisionId);
    const r = await this.prisma.admission_decision.updateMany({ where: { decision_id: d.decision_id, status: { in: ["DRAFT", "FAILED_SIGN"] } }, data: { status: "PENDING_SIGN" } });
    if (!r.count) conflict("INVALID_STATE", "Quyết định không ở trạng thái dự thảo.");
    await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "DECISION_SUBMIT", { table: "admission_decision", id: d.decision_id }, `Trình ký quyết định ${d.decision_no}`);
    return { success: true };
  }

  async rejectDecision(me: StaffUser, decisionId: number, body: Record<string, unknown>) {
    const note = String(body.note ?? "").trim();
    if (note.length < 10) fail("VALIDATION", "Ghi rõ lý do trả lại (ít nhất 10 ký tự).");
    const d = await this.loadDecision(decisionId);
    const r = await this.prisma.admission_decision.updateMany({ where: { decision_id: d.decision_id, status: "PENDING_SIGN" }, data: { status: "FAILED_SIGN", return_note: note.slice(0, 500) } });
    if (!r.count) conflict("INVALID_STATE", "Quyết định không ở trạng thái chờ ký.");
    await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "DECISION_RETURN", { table: "admission_decision", id: d.decision_id }, `Trả lại dự thảo quyết định ${d.decision_no}: ${note}`);
    return { success: true };
  }

  async signDecision(me: StaffUser, decisionId: number) {
    const days = await this.config.int("ENROLL_CONFIRM_DAYS", 15);
    return this.prisma.$transaction(
      async (tx) => {
        const d = await this.loadDecision(decisionId, tx);
        if (d.status !== "PENDING_SIGN") conflict("INVALID_STATE", "Quyết định không ở trạng thái chờ ký.");
        const items = await tx.decision_application.findMany({
          where: { decision_id: d.decision_id },
          include: { application: { include: { admission_result: true, admission_batch_major: { include: { admission_major: true } } } } },
        });
        const valid = items.filter((x) => !x.application.is_cancelled && x.application.admission_result?.result === "TRUNG_TUYEN");
        if (!valid.length) fail("NO_CANDIDATE", "Quyết định không còn thí sinh trúng tuyển hợp lệ.", HttpStatus.CONFLICT);
        const now = new Date();
        const deadline = deadlineAfterDays(now, days);
        // ISSUED — thay trigger #8: set admission_status = ADMITTED trong code (Filess.io free không có TRIGGER)
        await tx.admission_decision.update({
          where: { decision_id: d.decision_id },
          data: { status: "ISSUED", signed_by_staff_id: BigInt(me.staffAccountId), signed_at: now, signature_ref: `KS-${id(d.decision_id)}-${now.getTime().toString(36).toUpperCase()}`, return_note: null },
        });
        for (const x of valid) {
          const a = x.application;
          await tx.application.update({ where: { application_id: a.application_id }, data: { admission_status: "ADMITTED" } });
          await tx.enrollment_confirmation.upsert({
            where: { application_id: a.application_id },
            create: { application_id: a.application_id, deadline },
            update: {},
          });
          await this.audit.notifyCandidate(
            id(a.candidate_id),
            "Quyết định công nhận trúng tuyển — xác nhận nhập học",
            `Hồ sơ ${a.application_code}: Hiệu trưởng đã ký Quyết định số ${d.decision_no} ngày ${vnDate(d.decision_date ?? now)} công nhận bạn trúng tuyển ngành ${a.admission_batch_major.admission_major.major_name}.\nVui lòng vào cổng thí sinh bấm “Xác nhận nhập học” trước ${vnTime(deadline)}. Quá hạn không xác nhận được xem như từ chối nhập học. Bạn có thể in Giấy báo trúng tuyển trên cổng thí sinh.`,
            tx,
          );
        }
        await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "DECISION_ISSUE", { table: "admission_decision", id: d.decision_id }, `${d.admission_batch.batch_code}: ký ban hành quyết định ${d.decision_no} (${valid.length} thí sinh), hạn xác nhận nhập học ${vnTime(deadline)}`, tx);
        return { success: true, count: valid.length, deadline: isoReq(deadline) };
      },
      { timeout: 60_000 },
    );
  }

  /** Dữ liệu in quyết định / danh sách kèm theo */
  async decisionDetail(decisionId: number) {
    const d = await this.prisma.admission_decision.findUnique({
      where: { decision_id: BigInt(decisionId) },
      include: {
        admission_batch: true,
        staff_account: { select: { full_name: true } },
        decision_application: {
          include: { application: { include: { candidate: true, application_ranking: true, admission_batch_major: { include: { admission_major: true } } } } },
        },
      },
    });
    if (!d) notFound("Không tìm thấy quyết định.");
    const rows = d.decision_application
      .map((x) => x.application)
      .sort((a, b) => a.admission_batch_major.admission_major.major_name.localeCompare(b.admission_batch_major.admission_major.major_name, "vi") || (a.candidate.full_name.split(" ").pop() ?? "").localeCompare(b.candidate.full_name.split(" ").pop() ?? "", "vi"))
      .map((a) => ({
        applicationCode: a.application_code,
        fullName: a.candidate.full_name,
        dob: ymd(a.candidate.dob),
        gender: a.candidate.gender,
        majorCode: a.admission_batch_major.admission_major.major_code,
        majorName: a.admission_batch_major.admission_major.major_name,
        total: a.application_ranking ? Number(a.application_ranking.total_score) : null,
        cancelled: a.is_cancelled,
      }));
    return {
      decisionId: id(d.decision_id),
      decisionNo: d.decision_no,
      decisionDate: ymd(d.decision_date),
      status: d.status,
      statusLabel: DECISION_VI[d.status] ?? d.status,
      signedBy: d.staff_account?.full_name ?? null,
      signedAt: iso(d.signed_at),
      signatureRef: d.signature_ref,
      batch: { batchCode: d.admission_batch.batch_code, batchName: d.admission_batch.batch_name, degreeLevel: d.admission_batch.degree_level, legalBasis: d.admission_batch.legal_basis },
      rows,
    };
  }

  // ====================================================================== xác nhận nhập học
  /** Thí sinh xác nhận / từ chối (gọi từ cổng thí sinh) */
  async candidateRespond(candidateId: number, accept: boolean, body: Record<string, unknown>) {
    const reason = String(body.reason ?? "").trim().slice(0, 500);
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.enrollment_confirmation.findFirst({
        where: { application: { candidate_id: BigInt(candidateId), deleted_at: null, is_cancelled: false } },
        orderBy: { confirmation_id: "desc" },
        include: { application: { include: { enrollment_completion: true, admission_batch_major: { include: { admission_major: true } } } } },
      });
      if (!c) notFound("Bạn chưa có quyết định trúng tuyển cần xác nhận.");
      const a = c.application;
      if (accept) {
        if (c.status !== "CHUA_XAC_NHAN") conflict("INVALID_STATE", "Bạn đã phản hồi trước đó.");
        if (c.deadline.getTime() < Date.now()) fail("DEADLINE_PASSED", "Đã quá hạn xác nhận nhập học. Liên hệ Phòng Đào tạo Sau đại học.", HttpStatus.CONFLICT);
        // DA_XAC_NHAN — thay trigger #6: set admission_status = CONFIRMED trong code
        await tx.enrollment_confirmation.update({ where: { confirmation_id: c.confirmation_id }, data: { status: "DA_XAC_NHAN", confirmed_at: new Date() } });
        await tx.application.update({ where: { application_id: a.application_id }, data: { admission_status: "CONFIRMED" } });
        await tx.original_document_submission.upsert({ where: { application_id: a.application_id }, create: { application_id: a.application_id }, update: {} });
        await this.audit.record({ type: "CANDIDATE", id: candidateId }, "ENROLL_CONFIRM", { table: "enrollment_confirmation", id: c.confirmation_id }, `${a.application_code}: xác nhận nhập học`, tx);
        await this.audit.notifyCandidate(
          candidateId,
          "Đã ghi nhận xác nhận nhập học",
          `Hồ sơ ${a.application_code}: bạn đã xác nhận nhập học ngành ${a.admission_batch_major.admission_major.major_name}. Bước tiếp theo: nộp BẢN CHÍNH (hoặc bản sao chứng thực) các văn bằng, bảng điểm, chứng chỉ đã khai trực tuyến tại Phòng Đào tạo Sau đại học để đối chiếu. Sau khi đối chiếu xong, Nhà trường hoàn tất thủ tục và cấp mã học viên.`,
          tx,
        );
        return { success: true, status: "DA_XAC_NHAN" };
      }
      if (c.status === "TU_CHOI_QUA_HAN") conflict("INVALID_STATE", "Bạn đã từ chối nhập học trước đó.");
      if (a.enrollment_completion?.completed_at) conflict("INVALID_STATE", "Bạn đã hoàn tất nhập học, liên hệ Phòng Đào tạo Sau đại học nếu muốn thôi học.");
      if (reason.length < 5) fail("VALIDATION", "Cho biết lý do không nhập học (ít nhất 5 ký tự).");
      // TU_CHOI_QUA_HAN — thay trigger #6: set is_cancelled = 1 trong code
      await tx.enrollment_confirmation.update({ where: { confirmation_id: c.confirmation_id }, data: { status: "TU_CHOI_QUA_HAN" } });
      await tx.application.update({ where: { application_id: a.application_id }, data: { is_cancelled: true } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "ENROLL_DECLINE", { table: "enrollment_confirmation", id: c.confirmation_id }, `${a.application_code}: từ chối nhập học — ${reason}`, tx);
      await this.audit.notifyCandidate(candidateId, "Đã ghi nhận từ chối nhập học", `Hồ sơ ${a.application_code}: bạn đã từ chối nhập học ngành ${a.admission_batch_major.admission_major.major_name}. Chỗ của bạn được chuyển cho thí sinh dự bị.`, tx);
      const promoted = await this.results.promoteFromWaitlist(tx, a.batch_major_id, { type: "SYSTEM", id: null });
      return { success: true, status: "TU_CHOI_QUA_HAN", promoted: promoted.length };
    });
  }

  /** Quá hạn mà chưa xác nhận -> xem như từ chối, gọi dự bị */
  async processOverdue(me: StaffUser, batchId: number) {
    return this.expireOverdue({ type: "STAFF", id: me.staffAccountId }, batchId);
  }

  /** Dùng chung cho nút "Xử lý quá hạn" và tác vụ tự động (actor SYSTEM, batchId null = mọi đợt) */
  async expireOverdue(actor: { type: "STAFF" | "SYSTEM"; id: number | null }, batchId: number | null) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.enrollment_confirmation.findMany({
          where: { status: "CHUA_XAC_NHAN", deadline: { lt: new Date() }, ...(batchId !== null ? { application: { admission_batch_major: { batch_id: BigInt(batchId) } } } : {}) },
          include: { application: true },
        });
        const bms = new Set<bigint>();
        for (const c of rows) {
          await tx.enrollment_confirmation.update({ where: { confirmation_id: c.confirmation_id }, data: { status: "TU_CHOI_QUA_HAN" } });
          // Thay trigger #6: set is_cancelled khi quá hạn không xác nhận
          await tx.application.update({ where: { application_id: c.application_id }, data: { is_cancelled: true } });
          await this.audit.notifyCandidate(
            id(c.application.candidate_id),
            "Quá hạn xác nhận nhập học",
            `Hồ sơ ${c.application.application_code}: bạn không xác nhận nhập học trước ${vnTime(c.deadline)} nên được xem như từ chối nhập học. Liên hệ Phòng Đào tạo Sau đại học nếu có lý do chính đáng.`,
            tx,
          );
          bms.add(c.application.batch_major_id);
        }
        let promoted = 0;
        for (const bm of bms) promoted += (await this.results.promoteFromWaitlist(tx, bm, actor)).length;
        if (rows.length)
          await this.audit.record(actor, "ENROLL_OVERDUE", { table: "enrollment_confirmation", id: null }, `Xử lý ${rows.length} thí sinh quá hạn xác nhận nhập học (${rows.map((r) => r.application.application_code).join(", ")}), gọi ${promoted} dự bị`, tx);
        return { expired: rows.length, promoted };
      },
      { timeout: 60_000 },
    );
  }

  // ====================================================================== bản chính, hoàn tất
  async setOriginals(me: StaffUser, applicationId: number, body: Record<string, unknown>) {
    const status = String(body.status ?? "");
    if (!["VERIFIED", "MISSING"].includes(status)) fail("VALIDATION", "Trạng thái bản chính chỉ nhận Đã đối chiếu hoặc Còn thiếu.");
    const note = String(body.note ?? "").trim().slice(0, 500);
    if (status === "MISSING" && note.length < 5) fail("VALIDATION", "Ghi rõ giấy tờ còn thiếu để báo thí sinh.");
    const s = await this.prisma.original_document_submission.findUnique({ where: { application_id: BigInt(applicationId) }, include: { application: { include: { enrollment_confirmation: true, enrollment_completion: true } } } });
    if (!s || s.application.enrollment_confirmation?.status !== "DA_XAC_NHAN") fail("INVALID_STATE", "Thí sinh chưa xác nhận nhập học.", HttpStatus.CONFLICT);
    if (s.application.enrollment_completion?.completed_at) conflict("INVALID_STATE", "Thí sinh đã hoàn tất nhập học.");
    await this.prisma.$transaction(async (tx) => {
      await tx.original_document_submission.update({
        where: { submission_id: s.submission_id },
        data: status === "VERIFIED" ? { status, submitted_at: s.submitted_at ?? new Date(), verified_at: new Date(), verified_by_staff_id: BigInt(me.staffAccountId) } : { status, verified_at: null, verified_by_staff_id: null },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ORIGINALS_" + status, { table: "original_document_submission", id: s.submission_id }, `${s.application.application_code}: ${status === "VERIFIED" ? "đã đối chiếu bản chính" : `bản chính còn thiếu — ${note}`}`, tx);
      if (status === "MISSING")
        await this.audit.notifyCandidate(id(s.application.candidate_id), "Bổ sung bản chính hồ sơ nhập học", `Hồ sơ ${s.application.application_code}: còn thiếu bản chính — ${note}. Vui lòng nộp bổ sung tại Phòng Đào tạo Sau đại học.`, tx);
    });
    return { success: true };
  }

  async complete(me: StaffUser, applicationId: number) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.application.findUnique({
        where: { application_id: BigInt(applicationId) },
        include: { enrollment_confirmation: true, original_document_submission: true, enrollment_completion: true, admission_batch_major: { include: { admission_batch: true, admission_major: true } } },
      });
      if (!a) notFound("Không tìm thấy hồ sơ.");
      if (a.enrollment_confirmation?.status !== "DA_XAC_NHAN") fail("INVALID_STATE", "Thí sinh chưa xác nhận nhập học.", HttpStatus.CONFLICT);
      if (a.original_document_submission?.status !== "VERIFIED") fail("ORIGINALS_REQUIRED", "Chưa đối chiếu bản chính hồ sơ.", HttpStatus.CONFLICT);
      if (a.enrollment_completion?.completed_at) conflict("ALREADY_DONE", "Thí sinh đã hoàn tất nhập học.");
      const b = a.admission_batch_major.admission_batch;
      const prefix = `HV-${b.batch_code}-`;
      const last = await tx.enrollment_completion.findFirst({ where: { transfer_ref: { startsWith: prefix } }, orderBy: { transfer_ref: "desc" } });
      const ref = `${prefix}${String((last ? Number(last.transfer_ref!.slice(prefix.length)) || 0 : 0) + 1).padStart(4, "0")}`;
      // Thay trigger #7: set admission_status = ENROLLED trong code (Filess.io free không có TRIGGER)
      const row = a.enrollment_completion ?? (await tx.enrollment_completion.create({ data: { application_id: a.application_id } }));
      await tx.enrollment_completion.update({
        where: { completion_id: row.completion_id },
        data: { completed_at: new Date(), completed_by_staff_id: BigInt(me.staffAccountId), transfer_ref: ref, transferred_to_training: true },
      });
      await tx.application.update({ where: { application_id: a.application_id }, data: { admission_status: "ENROLLED" } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENROLL_COMPLETE", { table: "enrollment_completion", id: row.completion_id }, `${a.application_code}: hoàn tất nhập học, mã học viên ${ref}`, tx);
      await this.audit.notifyCandidate(
        id(a.candidate_id),
        "Hoàn tất thủ tục nhập học",
        `Chúc mừng bạn đã hoàn tất thủ tục nhập học ngành ${a.admission_batch_major.admission_major.major_name}. Mã học viên: ${ref}. Thông tin của bạn đã được chuyển sang bộ phận quản lý đào tạo sau đại học.`,
        tx,
      );
      return { success: true, transferRef: ref };
    });
  }
}
