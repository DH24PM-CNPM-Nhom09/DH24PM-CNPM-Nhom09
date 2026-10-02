import { Injectable } from "@nestjs/common";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq, num, str } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.score_appeal.findMany({
      include: {
        staff_account: { select: { full_name: true } },
        exam_score: {
          include: {
            exam_subject: true,
            application: { include: { candidate: true, admission_batch_major: { include: { admission_major: true } } } },
          },
        },
      },
      orderBy: { created_at: "asc" },
    });
    return rows
      .map((p) => {
        const app = p.exam_score.application;
        return {
          appealId: id(p.appeal_id),
          applicationId: id(app.application_id),
          subjectName: p.exam_score.exam_subject.subject_name,
          reason: p.reason,
          oldScore: Number(p.old_score),
          newScore: p.new_score === null ? null : Number(p.new_score),
          status: p.status,
          createdAt: isoReq(p.created_at),
          resolvedAt: iso(p.resolved_at),
          resolvedByStaffId: num(p.resolved_by_staff_id),
          resolutionNote: p.resolution_note,
          applicationCode: app.application_code,
          candidateName: app.candidate.full_name,
          majorName: app.admission_batch_major.admission_major.major_name,
          resolvedByName: p.staff_account?.full_name ?? null,
        };
      })
      .sort((a, b) => Number(a.status !== "PENDING") - Number(b.status !== "PENDING"));
  }

  /**
   * Kết luận phúc khảo. Khi điều chỉnh điểm, trigger #3 của CSDL tự cập nhật
   * exam_score và trigger #4 tự tính lại application_ranking.total_score.
   */
  async resolve(me: StaffUser, appealId: number, body: Record<string, unknown>) {
    const note = str(body.note).trim();
    if (note.length < 10) fail("NOTE_REQUIRED", "Ghi rõ kết luận của hội đồng (ít nhất 10 ký tự).");
    const p = await this.prisma.score_appeal.findUnique({
      where: { appeal_id: BigInt(appealId) },
      include: { exam_score: { include: { exam_subject: true, application: true } } },
    });
    if (!p) notFound("Không tìm thấy đơn phúc khảo.");
    if (p.status !== "PENDING") conflict("ALREADY_RESOLVED", "Đơn này đã được xử lý.");
    const oldScore = Number(p.old_score);
    let newScore = oldScore;
    let status = "RESOLVED_UNCHANGED";
    if (body.changed === true) {
      const s = Number(body.newScore);
      if (!(s >= 0 && s <= 10)) fail("INVALID_SCORE", "Điểm mới phải trong khoảng 0–10.");
      newScore = Math.round(s * 100) / 100;
      if (newScore === oldScore) fail("SCORE_UNCHANGED", "Điểm mới trùng điểm cũ — chọn “Giữ nguyên điểm”.");
      status = "RESOLVED_CHANGED";
    }
    const app = p.exam_score.application;
    const subject = p.exam_score.exam_subject.subject_name;
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.score_appeal.updateMany({
        where: { appeal_id: p.appeal_id, status: "PENDING" },
        data: { status, new_score: newScore, resolved_at: new Date(), resolved_by_staff_id: BigInt(me.staffAccountId), resolution_note: note },
      });
      if (res.count === 0) conflict("ALREADY_RESOLVED", "Đơn này vừa được người khác xử lý.");
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "APPEAL_RESOLVE",
        { table: "score_appeal", id: p.appeal_id },
        `${app.application_code}, ${subject}: ${oldScore} → ${newScore}`,
        tx,
      );
      await this.audit.notifyCandidate(
        id(app.candidate_id),
        "Kết quả phúc khảo",
        `Kết quả phúc khảo môn ${subject}: ${status === "RESOLVED_CHANGED" ? `điều chỉnh từ ${oldScore} thành ${newScore}` : "giữ nguyên điểm"}. ${note}`,
        tx,
      );
    });
    return { success: true };
  }
}
