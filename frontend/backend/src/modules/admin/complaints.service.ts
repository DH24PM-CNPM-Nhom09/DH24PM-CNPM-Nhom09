import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq, toInt } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

export const COMPLAINT_TYPE_VI: Record<string, string> = {
  PHUC_KHAO_DIEM: "Phúc khảo kết quả thi tiếng Anh",
  KHIEU_NAI_KET_QUA: "Khiếu nại kết quả xét tuyển",
  KHIEU_NAI_HO_SO: "Khiếu nại xử lý hồ sơ",
  KHAC: "Khác",
};
const STATUS = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"];

/**
 * Khiếu nại chung của thí sinh (bảng complaint, migration v4):
 *   PENDING (mới gửi) → IN_PROGRESS (cán bộ tiếp nhận) → RESOLVED (đã giải quyết) / REJECTED (không chấp nhận).
 * Mỗi bước gửi thông báo + email cho thí sinh; trả lời bắt buộc có nội dung. Không xóa khiếu nại.
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private dto(c: Prisma.complaintGetPayload<{ include: { candidate: { include: { candidate_account: true } }; application: { include: { admission_batch_major: { include: { admission_major: true; admission_batch: true } } } }; staff_account: true } }>) {
    return {
      complaintId: id(c.complaint_id),
      type: c.complaint_type,
      typeLabel: COMPLAINT_TYPE_VI[c.complaint_type] ?? c.complaint_type,
      content: c.content,
      status: c.status,
      response: c.response,
      createdAt: isoReq(c.created_at),
      resolvedAt: iso(c.resolved_at),
      handledBy: c.staff_account?.full_name ?? null,
      candidate: { candidateId: id(c.candidate_id), fullName: c.candidate.full_name, email: c.candidate.candidate_account.email, phone: c.candidate.candidate_account.phone_number },
      application: c.application
        ? {
            applicationId: id(c.application.application_id),
            applicationCode: c.application.application_code,
            majorName: c.application.admission_batch_major.admission_major.major_name,
            batchCode: c.application.admission_batch_major.admission_batch.batch_code,
            reviewStatus: c.application.review_status,
          }
        : null,
    };
  }

  private include = {
    candidate: { include: { candidate_account: true } },
    application: { include: { admission_batch_major: { include: { admission_major: true, admission_batch: true } } } },
    staff_account: true,
  } as const;

  async list(q: Record<string, string | undefined>) {
    const page = toInt(q.page, 1);
    const pageSize = Math.min(50, toInt(q.pageSize, 20));
    const where: Prisma.complaintWhereInput = {};
    if (q.status && STATUS.includes(q.status)) where.status = q.status;
    if (q.status === "OPEN") where.status = { in: ["PENDING", "IN_PROGRESS"] };
    if (q.type && COMPLAINT_TYPE_VI[q.type]) where.complaint_type = q.type;
    const s = (q.search ?? "").trim();
    if (s)
      where.OR = [
        { candidate: { full_name: { contains: s } } },
        { candidate: { candidate_account: { email: { contains: s } } } },
        { application: { application_code: { contains: s } } },
        { content: { contains: s } },
      ];
    const [total, rows, grouped] = await Promise.all([
      this.prisma.complaint.count({ where }),
      this.prisma.complaint.findMany({
        where,
        include: this.include,
        // Chưa xử lý lên trước, cũ nhất trước (xử lý theo thứ tự gửi)
        orderBy: [{ resolved_at: { sort: "asc", nulls: "first" } }, { created_at: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
    grouped.forEach((g) => (counts[g.status] = g._count._all));
    return { total, page, pageSize, counts, items: rows.map((r) => this.dto(r)) };
  }

  private async load(complaintId: number) {
    const c = await this.prisma.complaint.findUnique({ where: { complaint_id: BigInt(complaintId) }, include: this.include });
    if (!c) notFound("Không tìm thấy khiếu nại.");
    return c;
  }

  async accept(me: StaffUser, complaintId: number) {
    const c = await this.load(complaintId);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.complaint.updateMany({ where: { complaint_id: c.complaint_id, status: "PENDING" }, data: { status: "IN_PROGRESS", handled_by_staff_id: BigInt(me.staffAccountId) } });
      if (!r.count) conflict("INVALID_STATE", "Khiếu nại này đã được tiếp nhận.");
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "COMPLAINT_ACCEPT", { table: "complaint", id: c.complaint_id }, `Tiếp nhận khiếu nại #${id(c.complaint_id)} của ${c.candidate.full_name}`, tx);
      await this.audit.notifyCandidate(
        id(c.candidate_id),
        "Đã tiếp nhận khiếu nại",
        `Phòng Đào tạo Sau đại học đã tiếp nhận yêu cầu “${COMPLAINT_TYPE_VI[c.complaint_type]}” bạn gửi ngày ${c.created_at.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Kết quả xử lý sẽ được gửi qua cổng thí sinh và email.`,
        tx,
      );
    });
    return { success: true };
  }

  async respond(me: StaffUser, complaintId: number, body: Record<string, unknown>) {
    const status = String(body.status ?? "");
    const response = String(body.response ?? "").trim();
    if (!["RESOLVED", "REJECTED"].includes(status)) fail("VALIDATION", "Chọn kết quả: đã giải quyết hoặc không chấp nhận.");
    if (response.length < 20) fail("VALIDATION", "Nội dung trả lời cần ít nhất 20 ký tự để thí sinh hiểu rõ.");
    const c = await this.load(complaintId);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.complaint.updateMany({
        where: { complaint_id: c.complaint_id, status: { in: ["PENDING", "IN_PROGRESS"] } },
        data: { status, response: response.slice(0, 5000), resolved_at: new Date(), handled_by_staff_id: BigInt(me.staffAccountId) },
      });
      if (!r.count) conflict("INVALID_STATE", "Khiếu nại này đã được trả lời.");
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        status === "RESOLVED" ? "COMPLAINT_RESOLVE" : "COMPLAINT_REJECT",
        { table: "complaint", id: c.complaint_id },
        `Trả lời khiếu nại #${id(c.complaint_id)} của ${c.candidate.full_name}: ${status === "RESOLVED" ? "đã giải quyết" : "không chấp nhận"}`,
        tx,
      );
      await this.audit.notifyCandidate(
        id(c.candidate_id),
        status === "RESOLVED" ? "Kết quả giải quyết khiếu nại" : "Khiếu nại không được chấp nhận",
        `Yêu cầu “${COMPLAINT_TYPE_VI[c.complaint_type]}”${c.application ? ` (hồ sơ ${c.application.application_code})` : ""}:\n${response}`,
        tx,
      );
    });
    return { success: true };
  }

  /** Khiếu nại của chính thí sinh (cổng thí sinh) */
  async mine(candidateId: number) {
    const rows = await this.prisma.complaint.findMany({ where: { candidate_id: BigInt(candidateId) }, include: this.include, orderBy: { created_at: "desc" } });
    return rows.map((r) => {
      const d = this.dto(r);
      return { complaintId: d.complaintId, type: d.type, typeLabel: d.typeLabel, content: d.content, status: d.status, response: d.response, createdAt: d.createdAt, resolvedAt: d.resolvedAt, applicationCode: d.application?.applicationCode ?? null };
    });
  }
}
