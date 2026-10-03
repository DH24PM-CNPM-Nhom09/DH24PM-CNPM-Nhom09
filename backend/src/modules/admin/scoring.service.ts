import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ABSENT_NOTE,
  appealTransferNote,
  deadlineAfterDays,
  eligibleWhere,
  EXAM_FORMAT_VI,
  PENDING_REVIEW,
  RESULT_VI,
  ROLE_IN_COMMITTEE_VI,
  SCORING_BATCH_STATUS,
  vnTime,
  weightedTotal,
  workingSlots,
} from "../../common/admission";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { SystemConfigService } from "../../common/config.service";
import { conflict, fail, notFound } from "../../common/errors";
import { dec, id, iso, isoReq, ymd } from "../../common/util";
import { PrismaService, type Tx } from "../../prisma/prisma.service";

const ROLES = ["CHU_TICH", "THU_KY", "UY_VIEN"];

/**
 * M5 — Tổ chức xét tuyển theo từng ngành của đợt:
 *   tiểu ban xét tuyển → lịch phỏng vấn (thạc sĩ) / trình bày đề cương (tiến sĩ)
 *   → nhập điểm từng hình thức xét → công bố điểm (mở thời hạn phúc khảo).
 * Chỉ hồ sơ đã "Đạt" thẩm định mới được xét. Sau khi công bố, điểm chỉ thay đổi qua phúc khảo.
 */
@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
  ) {}

  private async loadBm(batchMajorId: number, db: Tx = this.prisma) {
    const bm = await db.admission_batch_major.findUnique({
      where: { batch_major_id: BigInt(batchMajorId) },
      include: { admission_batch: true, admission_major: true, exam_subject: { orderBy: { subject_id: "asc" } } },
    });
    if (!bm || bm.admission_batch.deleted_at) notFound("Không tìm thấy ngành trong đợt tuyển sinh.");
    return bm;
  }

  private assertScoringOpen(bm: { admission_batch: { status: string } }) {
    if (!SCORING_BATCH_STATUS.includes(bm.admission_batch.status))
      fail("BATCH_NOT_CLOSED", "Đợt tuyển sinh phải ở trạng thái “Đóng đăng ký” hoặc “Xét kết quả” mới tổ chức xét tuyển. Đổi trạng thái ở trang Đợt tuyển sinh.", HttpStatus.CONFLICT);
  }

  private assertNotPublished(bm: { scores_published_at: Date | null }) {
    if (bm.scores_published_at) fail("SCORES_PUBLISHED", "Điểm của ngành này đã công bố. Điểm chỉ được điều chỉnh qua phúc khảo.", HttpStatus.CONFLICT);
  }

  private async activeCommittee(batchMajorId: bigint, db: Tx = this.prisma) {
    return db.admission_committee.findFirst({
      where: { batch_major_id: batchMajorId, status: "ACTIVE" },
      orderBy: { committee_id: "desc" },
      include: { committee_member: { orderBy: { member_id: "asc" } } },
    });
  }

  /** Giai đoạn kết quả của một ngành (để hiện tiến độ) */
  static resultStage(rows: { approved_by_staff_id: bigint | null; published_at: Date | null }[]) {
    if (!rows.length) return "NOT_RANKED";
    if (rows.some((r) => r.published_at)) return "PUBLISHED";
    if (rows.every((r) => r.approved_by_staff_id)) return "PROPOSED";
    return "DRAFT";
  }

  // ====================================================================== danh sách đợt / ngành
  async batches() {
    const rows = await this.prisma.admission_batch.findMany({
      where: { deleted_at: null, status: { in: ["OPEN", "CLOSED", "IN_REVIEW", "COMPLETED"] } },
      orderBy: { batch_id: "desc" },
      include: { admission_batch_major: { include: { admission_major: true }, orderBy: { batch_major_id: "asc" } } },
    });
    const out = [];
    for (const b of rows) {
      const majors = [];
      for (const bm of b.admission_batch_major) {
        const [eligible, pendingReview, results] = await Promise.all([
          this.prisma.application.count({ where: eligibleWhere(bm.batch_major_id) }),
          this.prisma.application.count({ where: { batch_major_id: bm.batch_major_id, is_cancelled: false, deleted_at: null, review_status: { in: PENDING_REVIEW } } }),
          this.prisma.admission_result.findMany({
            where: { application: { batch_major_id: bm.batch_major_id } },
            select: { approved_by_staff_id: true, published_at: true, result: true },
          }),
        ]);
        majors.push({
          batchMajorId: id(bm.batch_major_id),
          majorCode: bm.admission_major.major_code,
          majorName: bm.admission_major.major_name,
          quota: bm.quota,
          eligible,
          pendingReview,
          scoresPublishedAt: iso(bm.scores_published_at),
          appealDeadline: iso(bm.appeal_deadline),
          resultStage: ScoringService.resultStage(results),
          admitted: results.filter((r) => r.published_at && r.result === "TRUNG_TUYEN").length,
        });
      }
      out.push({ batchId: id(b.batch_id), batchCode: b.batch_code, batchName: b.batch_name, degreeLevel: b.degree_level, status: b.status, majors });
    }
    return out;
  }

  // ====================================================================== tổng quan một ngành
  async overview(batchMajorId: number) {
    const bm = await this.loadBm(batchMajorId);
    const [committee, apps, pendingReview] = await Promise.all([
      this.activeCommittee(bm.batch_major_id),
      this.prisma.application.findMany({
        where: eligibleWhere(bm.batch_major_id),
        orderBy: { application_code: "asc" },
        include: {
          candidate: true,
          exam_score: true,
          interview_schedule: { where: { status: { not: "CANCELLED" } }, orderBy: { schedule_id: "desc" }, take: 1 },
          research_proposal: true,
          appeal_request: true,
        },
      }),
      this.prisma.application.count({ where: { batch_major_id: bm.batch_major_id, is_cancelled: false, deleted_at: null, review_status: { in: PENDING_REVIEW } } }),
    ]);
    const subjects = bm.exam_subject.map((s) => ({
      subjectId: id(s.subject_id),
      subjectName: s.subject_name,
      examFormat: s.exam_format,
      examFormatLabel: EXAM_FORMAT_VI[s.exam_format] ?? s.exam_format,
      weight: Number(s.weight),
      maxScore: Number(s.max_score),
    }));
    const isPhd = bm.admission_batch.degree_level === "TIEN_SI";
    const candidates = apps.map((a) => {
      const iv = a.interview_schedule[0];
      const scores = Object.fromEntries(
        a.exam_score.map((s) => [id(s.subject_id), { score: Number(s.score), absent: s.note === ABSENT_NOTE, note: s.note === ABSENT_NOTE ? null : s.note }]),
      );
      const complete = subjects.every((s) => scores[s.subjectId]);
      return {
        applicationId: id(a.application_id),
        applicationCode: a.application_code,
        fullName: a.candidate.full_name,
        dob: ymd(a.candidate.dob),
        researchTopic: a.research_proposal?.research_topic ?? null,
        interview: iv ? { scheduleId: id(iv.schedule_id), scheduledAt: isoReq(iv.scheduled_at), location: iv.location_or_link, status: iv.status } : null,
        scores,
        complete,
        absent: Object.values(scores).some((s) => s.absent),
        total: complete ? weightedTotal(subjects.map((s) => ({ score: scores[s.subjectId].score, weight: s.weight }))) : null,
        appeal: a.appeal_request ? { status: a.appeal_request.status } : null,
      };
    });
    const hasInterview = subjects.some((s) => s.examFormat === "PHONG_VAN");
    return {
      batch: { batchId: id(bm.batch_id), batchCode: bm.admission_batch.batch_code, batchName: bm.admission_batch.batch_name, status: bm.admission_batch.status, degreeLevel: bm.admission_batch.degree_level },
      major: { batchMajorId: id(bm.batch_major_id), majorCode: bm.admission_major.major_code, majorName: bm.admission_major.major_name, quota: bm.quota },
      interviewLabel: isPhd ? "Trình bày đề cương nghiên cứu" : "Phỏng vấn chuyên môn",
      subjects,
      hasInterview,
      committee: committee
        ? {
            committeeId: id(committee.committee_id),
            committeeName: committee.committee_name,
            decisionNo: committee.decision_no,
            formedAt: ymd(committee.formed_at),
            members: committee.committee_member.map((m) => ({ memberId: id(m.member_id), fullName: m.full_name, lecturerCode: m.lecturer_code, role: m.role_in_committee })),
          }
        : null,
      candidates,
      pendingReview,
      scoresPublishedAt: iso(bm.scores_published_at),
      appealDeadline: iso(bm.appeal_deadline),
      scoringOpen: SCORING_BATCH_STATUS.includes(bm.admission_batch.status),
      defaults: { interviewMinutes: await this.config.int("INTERVIEW_MINUTES", 20), appealWindowDays: await this.config.int("APPEAL_WINDOW_DAYS", 7) },
      stats: {
        total: candidates.length,
        scheduled: candidates.filter((c) => c.interview).length,
        complete: candidates.filter((c) => c.complete).length,
      },
    };
  }

  // ====================================================================== tiểu ban
  async saveCommittee(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const bm = await this.loadBm(batchMajorId);
    this.assertNotPublished(bm);
    const name = String(body.committeeName ?? "").trim().replace(/\s+/g, " ");
    const decisionNo = String(body.decisionNo ?? "").trim().slice(0, 50) || null;
    const formedRaw = String(body.formedAt ?? "").trim();
    const formedAt = formedRaw ? new Date(`${formedRaw}T00:00:00Z`) : null;
    if (name.length < 5 || name.length > 255) fail("VALIDATION", "Nhập tên tiểu ban (ví dụ: Tiểu ban xét tuyển ngành Khoa học máy tính).");
    if (formedAt && Number.isNaN(formedAt.getTime())) fail("VALIDATION", "Ngày thành lập không hợp lệ.");
    const raw = Array.isArray(body.members) ? (body.members as Record<string, unknown>[]) : [];
    const members = raw
      .map((m) => ({ fullName: String(m.fullName ?? "").trim().replace(/\s+/g, " "), lecturerCode: String(m.lecturerCode ?? "").trim().slice(0, 30) || null, role: String(m.role ?? "") }))
      .filter((m) => m.fullName);
    if (members.length < 3) fail("VALIDATION", "Tiểu ban cần ít nhất 3 thành viên.");
    if (members.some((m) => !ROLES.includes(m.role) || m.fullName.length > 255)) fail("VALIDATION", "Vai trò thành viên chỉ nhận Chủ tịch, Thư ký hoặc Ủy viên.");
    if (members.filter((m) => m.role === "CHU_TICH").length !== 1) fail("VALIDATION", "Tiểu ban phải có đúng 1 Chủ tịch.");
    if (members.filter((m) => m.role === "THU_KY").length !== 1) fail("VALIDATION", "Tiểu ban phải có đúng 1 Thư ký.");
    const names = members.map((m) => m.fullName.toLowerCase());
    if (new Set(names).size !== names.length) fail("VALIDATION", "Một người không giữ hai vai trò trong tiểu ban.");

    const existing = await this.activeCommittee(bm.batch_major_id);
    await this.prisma.$transaction(async (tx) => {
      let committeeId: bigint;
      if (existing) {
        committeeId = existing.committee_id;
        await tx.admission_committee.update({ where: { committee_id: committeeId }, data: { committee_name: name, decision_no: decisionNo, formed_at: formedAt } });
        // Danh sách thành viên thay mới theo quyết định (lịch sử thay đổi nằm ở nhật ký)
        await tx.committee_member.deleteMany({ where: { committee_id: committeeId } });
      } else {
        committeeId = (await tx.admission_committee.create({ data: { batch_major_id: bm.batch_major_id, committee_name: name, decision_no: decisionNo, formed_at: formedAt } })).committee_id;
      }
      await tx.committee_member.createMany({
        data: members.map((m) => ({ committee_id: committeeId, full_name: m.fullName, lecturer_code: m.lecturerCode, role_in_committee: m.role })),
      });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        existing ? "COMMITTEE_UPDATE" : "COMMITTEE_CREATE",
        { table: "admission_committee", id: committeeId },
        `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: ${name}${decisionNo ? ` (QĐ ${decisionNo})` : ""}; ${members.map((m) => `${ROLE_IN_COMMITTEE_VI[m.role]} ${m.fullName}`).join(", ")}`,
        tx,
      );
    });
    return { success: true };
  }

  // ====================================================================== lịch phỏng vấn / trình bày đề cương
  private async notifyInterview(tx: Tx, candidateId: bigint, code: string, label: string, at: Date, location: string | null, committeeName: string, changed = false) {
    await this.audit.notifyCandidate(
      id(candidateId),
      `${changed ? "Thay đổi lịch" : "Lịch"} ${label.toLowerCase()}`,
      `Hồ sơ ${code}: ${label.toLowerCase()} trước ${committeeName}.\nThời gian: ${vnTime(at)}${location ? `\nĐịa điểm / đường dẫn: ${location}` : ""}\nCó mặt trước giờ hẹn 15 phút, mang theo CCCD bản gốc${label.startsWith("Trình bày") ? " và bản in đề cương nghiên cứu" : ""}. Vắng mặt không có lý do chính đáng sẽ không được xét tuyển.`,
      tx,
    );
  }

  async autoSchedule(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const bm = await this.loadBm(batchMajorId);
    this.assertScoringOpen(bm);
    this.assertNotPublished(bm);
    if (!bm.exam_subject.some((s) => s.exam_format === "PHONG_VAN"))
      fail("NO_INTERVIEW", "Ngành này không có hình thức phỏng vấn / trình bày nên không cần xếp lịch.", HttpStatus.CONFLICT);
    const committee = await this.activeCommittee(bm.batch_major_id);
    if (!committee) fail("NO_COMMITTEE", "Lập tiểu ban xét tuyển trước khi xếp lịch.", HttpStatus.CONFLICT);
    const startAt = new Date(String(body.startAt ?? ""));
    const minutes = Number(body.minutes);
    const location = String(body.location ?? "").trim().replace(/\s+/g, " ").slice(0, 500) || null;
    if (Number.isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) fail("VALIDATION", "Chọn thời điểm bắt đầu ở tương lai.");
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) fail("VALIDATION", "Mỗi lượt từ 5 đến 120 phút.");
    if (!location) fail("VALIDATION", "Nhập địa điểm (phòng) hoặc đường dẫn họp trực tuyến.");
    const label = bm.admission_batch.degree_level === "TIEN_SI" ? "Trình bày đề cương nghiên cứu" : "Phỏng vấn chuyên môn";

    return this.prisma.$transaction(
      async (tx) => {
        const waiting = await tx.application.findMany({
          where: { ...eligibleWhere(bm.batch_major_id), interview_schedule: { none: { status: { not: "CANCELLED" } } } },
          orderBy: { application_code: "asc" },
        });
        if (!waiting.length) return { scheduled: 0 };
        const slots = workingSlots(startAt, minutes);
        for (const a of waiting) {
          const at = slots.next().value as Date;
          await tx.interview_schedule.create({ data: { application_id: a.application_id, committee_id: committee.committee_id, scheduled_at: at, location_or_link: location } });
          await this.notifyInterview(tx, a.candidate_id, a.application_code, label, at, location, committee.committee_name);
        }
        await this.audit.record(
          { type: "STAFF", id: me.staffAccountId },
          "INTERVIEW_SCHEDULE",
          { table: "interview_schedule", id: null },
          `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: xếp lịch ${label.toLowerCase()} cho ${waiting.length} thí sinh từ ${vnTime(startAt)}, ${minutes} phút/lượt`,
          tx,
        );
        return { scheduled: waiting.length };
      },
      { timeout: 60_000 },
    );
  }

  async updateInterview(me: StaffUser, scheduleId: number, body: Record<string, unknown>) {
    const s = await this.prisma.interview_schedule.findUnique({
      where: { schedule_id: BigInt(scheduleId) },
      include: { application: true, admission_committee: true },
    });
    if (!s) notFound("Không tìm thấy lịch.");
    if (s.status !== "SCHEDULED") fail("INVALID_STATE", "Lịch này đã có điểm, không đổi được.", HttpStatus.CONFLICT);
    const bm = await this.loadBm(id(s.application.batch_major_id));
    this.assertNotPublished(bm);
    const at = new Date(String(body.scheduledAt ?? ""));
    const location = String(body.location ?? "").trim().replace(/\s+/g, " ").slice(0, 500) || null;
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) fail("VALIDATION", "Chọn thời gian ở tương lai.");
    if (!location) fail("VALIDATION", "Nhập địa điểm hoặc đường dẫn.");
    const label = bm.admission_batch.degree_level === "TIEN_SI" ? "Trình bày đề cương nghiên cứu" : "Phỏng vấn chuyên môn";
    await this.prisma.$transaction(async (tx) => {
      await tx.interview_schedule.update({ where: { schedule_id: s.schedule_id }, data: { scheduled_at: at, location_or_link: location } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "INTERVIEW_UPDATE", { table: "interview_schedule", id: s.schedule_id }, `${s.application.application_code}: đổi lịch sang ${vnTime(at)}, ${location}`, tx);
      await this.notifyInterview(tx, s.application.candidate_id, s.application.application_code, label, at, location, s.admission_committee.committee_name, true);
    });
    return { success: true };
  }

  // ====================================================================== nhập điểm
  async saveScores(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const bm = await this.loadBm(batchMajorId);
    this.assertScoringOpen(bm);
    this.assertNotPublished(bm);
    const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    if (!items.length) fail("VALIDATION", "Chưa có điểm nào để lưu.");
    const subjects = new Map(bm.exam_subject.map((s) => [id(s.subject_id), s]));
    const apps = await this.prisma.application.findMany({
      where: { ...eligibleWhere(bm.batch_major_id), application_id: { in: [...new Set(items.map((i) => BigInt(Number(i.applicationId) || 0)))] } },
      include: { exam_score: true, interview_schedule: { where: { status: { not: "CANCELLED" } }, orderBy: { schedule_id: "desc" }, take: 1 } },
    });
    const byId = new Map(apps.map((a) => [id(a.application_id), a]));
    let changed = 0;
    await this.prisma.$transaction(
      async (tx) => {
        for (const it of items) {
          const a = byId.get(Number(it.applicationId));
          if (!a) fail("VALIDATION", "Có hồ sơ không thuộc danh sách xét tuyển của ngành này.");
          const subj = subjects.get(Number(it.subjectId));
          if (!subj) fail("VALIDATION", "Hình thức xét không thuộc ngành này.");
          const absent = it.absent === true;
          const rawScore = it.score === null || it.score === undefined || it.score === "" ? null : Number(String(it.score).replace(",", "."));
          if (!absent && rawScore === null) continue; // ô trống: bỏ qua
          const max = Number(subj.max_score);
          if (!absent && (!Number.isFinite(rawScore) || (rawScore as number) < 0 || (rawScore as number) > max))
            fail("VALIDATION", `Điểm “${subj.subject_name}” của hồ sơ ${a.application_code} phải từ 0 đến ${max}.`);
          if (absent && subj.exam_format === "XET_HO_SO") fail("VALIDATION", `“${subj.subject_name}” là xét hồ sơ, không có trường hợp vắng.`);
          const iv = a.interview_schedule[0];
          if (subj.exam_format === "PHONG_VAN") {
            if (!iv) fail("NO_SCHEDULE", `Hồ sơ ${a.application_code} chưa có lịch ${subj.subject_name.toLowerCase()}.`, HttpStatus.CONFLICT);
            if (iv.scheduled_at.getTime() > Date.now()) fail("NOT_YET", `Chưa đến giờ ${subj.subject_name.toLowerCase()} của hồ sơ ${a.application_code}.`, HttpStatus.CONFLICT);
          }
          const score = absent ? 0 : Math.round((rawScore as number) * 100) / 100;
          const note = absent ? ABSENT_NOTE : String(it.note ?? "").trim().slice(0, 500) || null;
          const old = a.exam_score.find((s) => s.subject_id === subj.subject_id);
          if (old && Number(old.score) === score && (old.note ?? null) === note) continue;
          // INSERT/UPDATE exam_score -> trigger #4 tự tính lại application_ranking.total_score
          if (old) await tx.exam_score.update({ where: { score_id: old.score_id }, data: { score: new Prisma.Decimal(score.toFixed(2)), note, grader_staff_id: BigInt(me.staffAccountId), graded_at: new Date() } });
          else await tx.exam_score.create({ data: { application_id: a.application_id, subject_id: subj.subject_id, score: new Prisma.Decimal(score.toFixed(2)), note, grader_staff_id: BigInt(me.staffAccountId) } });
          if (subj.exam_format === "PHONG_VAN" && iv) await tx.interview_schedule.update({ where: { schedule_id: iv.schedule_id }, data: { status: "COMPLETED" } });
          changed++;
        }
        if (changed)
          await this.audit.record(
            { type: "STAFF", id: me.staffAccountId },
            "SCORE_ENTER",
            { table: "exam_score", id: null },
            `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: nhập/sửa ${changed} điểm thành phần`,
            tx,
          );
      },
      { timeout: 60_000 },
    );
    return { success: true, changed };
  }

  // ====================================================================== công bố điểm
  async publishScores(me: StaffUser, batchMajorId: number) {
    const bm = await this.loadBm(batchMajorId);
    this.assertScoringOpen(bm);
    this.assertNotPublished(bm);
    const pending = await this.prisma.application.count({ where: { batch_major_id: bm.batch_major_id, is_cancelled: false, deleted_at: null, review_status: { in: PENDING_REVIEW } } });
    if (pending) fail("REVIEW_PENDING", `Còn ${pending} hồ sơ của ngành chưa thẩm định xong. Kết luận hết hồ sơ trước khi công bố điểm.`, HttpStatus.CONFLICT);
    const apps = await this.prisma.application.findMany({ where: eligibleWhere(bm.batch_major_id), include: { exam_score: true } });
    if (!apps.length) fail("NO_CANDIDATE", "Ngành này không có hồ sơ nào đạt thẩm định để công bố điểm.", HttpStatus.CONFLICT);
    const missing = apps.filter((a) => bm.exam_subject.some((s) => !a.exam_score.some((x) => x.subject_id === s.subject_id)));
    if (missing.length) fail("SCORES_INCOMPLETE", `Còn ${missing.length} thí sinh chưa đủ điểm các hình thức xét (ví dụ ${missing[0].application_code}).`, HttpStatus.CONFLICT);
    const days = await this.config.int("APPEAL_WINDOW_DAYS", 7);
    const fee = await this.config.int("FEE_APPEAL", 360_000);
    const now = new Date();
    const deadline = deadlineAfterDays(now, days);
    await this.prisma.$transaction(
      async (tx) => {
        const r = await tx.admission_batch_major.updateMany({ where: { batch_major_id: bm.batch_major_id, scores_published_at: null }, data: { scores_published_at: now, appeal_deadline: deadline } });
        if (r.count === 0) conflict("SCORES_PUBLISHED", "Điểm của ngành này vừa được công bố.");
        for (const a of apps) {
          const lines = bm.exam_subject.map((s) => {
            const x = a.exam_score.find((e) => e.subject_id === s.subject_id)!;
            return `- ${s.subject_name} (hệ số ${Number(s.weight)}): ${x.note === ABSENT_NOTE ? "vắng" : Number(x.score)}`;
          });
          const total = weightedTotal(bm.exam_subject.map((s) => ({ score: Number(a.exam_score.find((e) => e.subject_id === s.subject_id)!.score), weight: Number(s.weight) })));
          await this.audit.notifyCandidate(
            id(a.candidate_id),
            "Công bố điểm xét tuyển",
            `Hồ sơ ${a.application_code} — ${bm.admission_major.major_name}:\n${lines.join("\n")}\nTổng điểm: ${total}/10.\nNếu chưa đồng ý, bạn có thể nộp đơn phúc khảo trên cổng thí sinh trước 17:00 ngày ${deadline.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (lệ phí ${fee.toLocaleString("vi-VN")} đồng/hồ sơ). Kết quả trúng tuyển sẽ được công bố sau khi hết hạn phúc khảo.`,
            tx,
          );
        }
        await this.audit.record(
          { type: "STAFF", id: me.staffAccountId },
          "SCORES_PUBLISH",
          { table: "admission_batch_major", id: bm.batch_major_id },
          `${bm.admission_batch.batch_code} – ${bm.admission_major.major_name}: công bố điểm ${apps.length} thí sinh, hạn phúc khảo ${vnTime(deadline)}`,
          tx,
        );
      },
      { timeout: 60_000 },
    );
    return { success: true, appealDeadline: deadline.toISOString() };
  }

  // ====================================================================== phúc khảo (phía cán bộ)
  async confirmAppealPayment(me: StaffUser, requestId: number, body: Record<string, unknown>) {
    const receiptNo = String(body.receiptNo ?? "").trim().slice(0, 50) || null;
    const r = await this.prisma.appeal_request.findUnique({ where: { request_id: BigInt(requestId) }, include: { application: true } });
    if (!r) notFound("Không tìm thấy đơn phúc khảo.");
    if (r.status !== "CHO_NOP_PHI") conflict("INVALID_STATE", "Đơn này không ở trạng thái chờ nộp lệ phí.");
    await this.prisma.$transaction(async (tx) => {
      await tx.appeal_request.update({ where: { request_id: r.request_id }, data: { status: "DA_NOP_PHI", paid_at: new Date(), receipt_no: receiptNo, confirmed_by_staff_id: BigInt(me.staffAccountId) } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "APPEAL_FEE_CONFIRM", { table: "appeal_request", id: r.request_id }, `${r.application.application_code}: đã nhận lệ phí phúc khảo ${Number(r.fee_amount).toLocaleString("vi-VN")} đ${receiptNo ? `, biên lai ${receiptNo}` : ""}`, tx);
      await this.audit.notifyCandidate(id(r.application.candidate_id), "Đã nhận lệ phí phúc khảo", `Phòng Đào tạo Sau đại học đã nhận lệ phí phúc khảo của hồ sơ ${r.application.application_code}. Đơn của bạn đang được hội đồng xem xét.`, tx);
    });
    return { success: true };
  }

  /** Đóng đơn không nộp lệ phí khi đã hết hạn phúc khảo — các điểm giữ nguyên */
  async closeUnpaidAppeal(me: StaffUser, requestId: number) {
    const r = await this.prisma.appeal_request.findUnique({ where: { request_id: BigInt(requestId) }, include: { application: { include: { admission_batch_major: true } } } });
    if (!r) notFound("Không tìm thấy đơn phúc khảo.");
    if (r.status !== "CHO_NOP_PHI") conflict("INVALID_STATE", "Chỉ đóng được đơn chưa nộp lệ phí.");
    const dl = r.application.admission_batch_major.appeal_deadline;
    if (dl && dl.getTime() > Date.now()) fail("NOT_YET", "Chưa hết hạn phúc khảo, thí sinh vẫn có thể nộp lệ phí.", HttpStatus.CONFLICT);
    const note = "Đơn không được xem xét do thí sinh không nộp lệ phí phúc khảo trong thời hạn.";
    await this.prisma.$transaction(async (tx) => {
      await tx.appeal_request.update({ where: { request_id: r.request_id }, data: { status: "DONG" } });
      const ids = (await tx.score_appeal.findMany({ where: { status: "PENDING", exam_score: { application_id: r.application_id } }, select: { appeal_id: true } })).map((x) => x.appeal_id);
      await tx.score_appeal.updateMany({
        where: { appeal_id: { in: ids } },
        data: { status: "RESOLVED_UNCHANGED", resolved_at: new Date(), resolved_by_staff_id: BigInt(me.staffAccountId), resolution_note: note },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "APPEAL_CLOSE_UNPAID", { table: "appeal_request", id: r.request_id }, `${r.application.application_code}: đóng đơn phúc khảo chưa nộp lệ phí`, tx);
      await this.audit.notifyCandidate(id(r.application.candidate_id), "Đơn phúc khảo không được xem xét", `Hồ sơ ${r.application.application_code}: ${note} Điểm xét tuyển giữ nguyên.`, tx);
    });
    return { success: true };
  }

  // ====================================================================== phúc khảo (phía thí sinh)
  async fileAppeal(candidateId: number, body: Record<string, unknown>) {
    const a = await this.prisma.application.findFirst({
      where: { candidate_id: BigInt(candidateId), is_cancelled: false, deleted_at: null, review_status: "APPROVED" },
      orderBy: { application_id: "desc" },
      include: { admission_batch_major: { include: { exam_subject: true } }, exam_score: true, appeal_request: true },
    });
    if (!a) notFound("Không có hồ sơ nào đang xét tuyển.");
    const bm = a.admission_batch_major;
    if (!bm.scores_published_at || !bm.appeal_deadline) fail("NOT_PUBLISHED", "Điểm chưa được công bố.", HttpStatus.CONFLICT);
    if (bm.appeal_deadline.getTime() < Date.now()) fail("APPEAL_CLOSED", "Đã hết hạn nộp đơn phúc khảo.", HttpStatus.CONFLICT);
    if (a.appeal_request) conflict("ALREADY_APPEALED", "Bạn đã nộp đơn phúc khảo cho hồ sơ này.");
    const reason = String(body.reason ?? "").trim();
    if (reason.length < 20 || reason.length > 2000) fail("VALIDATION", "Trình bày lý do phúc khảo (từ 20 đến 2000 ký tự).");
    const subjectIds = [...new Set((Array.isArray(body.subjectIds) ? body.subjectIds : []).map(Number))];
    if (!subjectIds.length) fail("VALIDATION", "Chọn ít nhất một điểm thành phần cần phúc khảo.");
    const scores = subjectIds.map((sid) => {
      const s = a.exam_score.find((x) => id(x.subject_id) === sid);
      if (!s) fail("VALIDATION", "Điểm thành phần không hợp lệ.");
      if (s.note === ABSENT_NOTE) fail("VALIDATION", "Không phúc khảo được phần thí sinh vắng mặt.");
      return s;
    });
    const fee = await this.config.int("FEE_APPEAL", 360_000);
    await this.prisma.$transaction(async (tx) => {
      const req = await tx.appeal_request.create({ data: { application_id: a.application_id, reason: reason, fee_amount: new Prisma.Decimal(fee), status: fee > 0 ? "CHO_NOP_PHI" : "DA_NOP_PHI" } });
      for (const s of scores) await tx.score_appeal.create({ data: { score_id: s.score_id, reason, old_score: s.score } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "APPEAL_CREATE", { table: "appeal_request", id: req.request_id }, `${a.application_code}: nộp đơn phúc khảo ${scores.length} điểm thành phần`, tx);
      await this.audit.notifyCandidate(
        candidateId,
        "Đã nhận đơn phúc khảo",
        fee > 0
          ? `Đơn phúc khảo hồ sơ ${a.application_code} đã được ghi nhận. Vui lòng chuyển khoản lệ phí ${fee.toLocaleString("vi-VN")} đồng với nội dung ${appealTransferNote(a.application_code)} (mã QR trên trang hồ sơ). Đơn được xem xét sau khi Phòng Đào tạo Sau đại học xác nhận đã nhận lệ phí.`
          : `Đơn phúc khảo hồ sơ ${a.application_code} đã được ghi nhận và chuyển hội đồng xem xét.`,
        tx,
      );
    });
    return { success: true };
  }

  /** Dùng chung cho trang hồ sơ thí sinh và trang chi tiết hồ sơ của cán bộ */
  static resultLabel(result: string | null) {
    return result ? (RESULT_VI[result] ?? result) : null;
  }
}
