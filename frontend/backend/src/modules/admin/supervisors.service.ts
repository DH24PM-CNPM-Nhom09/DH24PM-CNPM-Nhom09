import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit.service";
import type { CandidateUser, StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

/** Số lần tối đa một nghiên cứu sinh được gửi đề nghị hướng dẫn trong một hồ sơ */
const MAX_REQUESTS = 3;
/** Hồ sơ đã nộp, còn đang xét hoặc đạt thì mới được đề nghị GVHD */
const OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT", "APPROVED"];

/**
 * Giảng viên hướng dẫn (bậc tiến sĩ).
 * - Thí sinh tiến sĩ chọn GV dự kiến khi nộp hồ sơ (tạo supervisor_request PENDING).
 * - Cán bộ ghi nhận GV đồng ý / từ chối (sau khi GV xác nhận bằng giấy đồng ý hướng dẫn).
 * - Bị từ chối: thí sinh tự chọn GV khác và gửi lại (tối đa MAX_REQUESTS lần).
 * - Danh mục giảng viên: thêm, sửa, ngừng nhận hướng dẫn (không xóa vì còn lịch sử).
 */
@Injectable()
export class SupervisorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ====================================================================== phía thí sinh
  private async myApplication(candidateId: number) {
    return this.prisma.application.findFirst({
      where: { candidate_id: BigInt(candidateId), is_cancelled: false, deleted_at: null },
      orderBy: { application_id: "desc" },
      include: {
        admission_batch_major: { include: { admission_batch: true, admission_major: true } },
        research_proposal: { include: { supervisor_request: { orderBy: { request_id: "desc" }, include: { lecturer: true } } } },
      },
    });
  }

  async mine(me: CandidateUser) {
    if (!me.candidateId) return { state: "NO_APPLICATION" as const };
    const a = await this.myApplication(me.candidateId);
    if (!a) return { state: "NO_APPLICATION" as const };
    const degree = a.admission_batch_major.admission_batch.degree_level;
    const base = {
      applicationCode: a.application_code,
      reviewStatus: a.review_status,
      degreeLevel: degree,
      majorName: a.admission_batch_major.admission_major.major_name,
    };
    if (degree !== "TIEN_SI") return { state: "MASTER" as const, ...base };
    if (a.review_status === "DRAFT") return { state: "DRAFT" as const, ...base };
    const p = a.research_proposal;
    const requests = (p?.supervisor_request ?? []).map((r) => ({
      requestId: id(r.request_id),
      lecturerId: id(r.lecturer_id),
      lecturerName: r.lecturer.full_name,
      facultyName: r.lecturer.faculty_name ?? "",
      status: r.status as "PENDING" | "ACCEPTED" | "REJECTED",
      requestedAt: isoReq(r.requested_at),
      respondedAt: iso(r.responded_at),
      responseNote: r.response_note,
    }));
    const busy = requests.some((r) => r.status === "PENDING" || r.status === "ACCEPTED");
    return {
      state: "DOCTORAL" as const,
      ...base,
      researchTopic: p?.research_topic ?? null,
      researchField: p?.research_field ?? null,
      requests,
      canRequest: Boolean(p) && !busy && OPEN_STATUSES.includes(a.review_status) && requests.length < MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - requests.length),
    };
  }

  /** Gửi đề nghị hướng dẫn tới GV (lần đầu chưa chọn, hoặc chọn lại sau khi bị từ chối) */
  async request(me: CandidateUser, lecturerIdRaw: unknown) {
    if (!me.candidateId) fail("PROFILE_REQUIRED", "Vui lòng hoàn thiện hồ sơ cá nhân trước.", HttpStatus.CONFLICT);
    const lecturerId = Number(lecturerIdRaw);
    if (!Number.isInteger(lecturerId) || lecturerId <= 0) fail("VALIDATION", "Chọn giảng viên hướng dẫn.");
    const a = await this.myApplication(me.candidateId);
    if (!a || a.admission_batch_major.admission_batch.degree_level !== "TIEN_SI") fail("NOT_DOCTORAL", "Chỉ hồ sơ tiến sĩ mới đăng ký giảng viên hướng dẫn.", HttpStatus.CONFLICT);
    if (!OPEN_STATUSES.includes(a.review_status)) fail("INVALID_STATE", "Hồ sơ chưa nộp hoặc đã kết thúc, không gửi được đề nghị hướng dẫn.", HttpStatus.CONFLICT);
    const p = a.research_proposal;
    if (!p) fail("PROPOSAL_REQUIRED", "Hồ sơ chưa có đề tài nghiên cứu.", HttpStatus.CONFLICT);
    const reqs = p.supervisor_request;
    if (reqs.some((r) => r.status === "PENDING")) conflict("REQUEST_PENDING", "Đề nghị trước đang chờ giảng viên phản hồi.");
    if (reqs.some((r) => r.status === "ACCEPTED")) conflict("ALREADY_ACCEPTED", "Bạn đã có giảng viên đồng ý hướng dẫn.");
    if (reqs.length >= MAX_REQUESTS) conflict("TOO_MANY_REQUESTS", `Bạn đã gửi ${MAX_REQUESTS} đề nghị. Liên hệ Phòng Đào tạo Sau đại học để được hỗ trợ phân công.`);
    if (reqs.some((r) => id(r.lecturer_id) === lecturerId)) conflict("ALREADY_ASKED", "Giảng viên này đã phản hồi đề nghị của bạn trước đó. Hãy chọn giảng viên khác.");
    const lec = await this.prisma.lecturer.findFirst({ where: { lecturer_id: BigInt(lecturerId), status: "ACTIVE", deleted_at: null } });
    if (!lec) fail("VALIDATION", "Giảng viên không tồn tại hoặc đã ngừng nhận hướng dẫn.");
    await this.prisma.$transaction(async (tx) => {
      await tx.research_proposal.update({ where: { proposal_id: p.proposal_id }, data: { preferred_lecturer_id: lec.lecturer_id } });
      const r = await tx.supervisor_request.create({ data: { proposal_id: p.proposal_id, lecturer_id: lec.lecturer_id } });
      await this.audit.record({ type: "CANDIDATE", id: me.candidateId }, "SUPERVISOR_REQUEST", { table: "supervisor_request", id: r.request_id }, `${a.application_code}: đề nghị ${lec.full_name} hướng dẫn`, tx);
    });
    return this.mine(me);
  }

  // ====================================================================== phía cán bộ
  async listRequests(q: Record<string, string | undefined>) {
    const where: Prisma.supervisor_requestWhereInput = {
      research_proposal: { application: { is_cancelled: false, deleted_at: null, review_status: { not: "DRAFT" } } },
    };
    if (q.status && ["PENDING", "ACCEPTED", "REJECTED"].includes(q.status)) where.status = q.status;
    if (q.lecturerId) where.lecturer_id = BigInt(Number(q.lecturerId) || 0);
    const text = (q.q ?? "").trim();
    if (text)
      where.OR = [
        { lecturer: { full_name: { contains: text } } },
        { research_proposal: { research_topic: { contains: text } } },
        { research_proposal: { application: { application_code: { contains: text } } } },
        { research_proposal: { application: { candidate: { full_name: { contains: text } } } } },
      ];
    const [rows, grouped] = await Promise.all([
      this.prisma.supervisor_request.findMany({
        where,
        orderBy: { request_id: "desc" },
        take: 300,
        include: {
          lecturer: true,
          research_proposal: { include: { application: { include: { candidate: true, admission_batch_major: { include: { admission_major: true } } } } } },
        },
      }),
      this.prisma.supervisor_request.groupBy({ by: ["status"], where: { ...where, status: undefined }, _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = { ALL: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 };
    grouped.forEach((g) => {
      counts[g.status] = g._count._all;
      counts.ALL += g._count._all;
    });
    return {
      counts,
      // Đề nghị đang chờ phản hồi lên đầu
      items: [...rows.filter((r) => r.status === "PENDING"), ...rows.filter((r) => r.status !== "PENDING")].map((r) => {
        const app = r.research_proposal.application;
        return {
          requestId: id(r.request_id),
          status: r.status,
          requestedAt: isoReq(r.requested_at),
          respondedAt: iso(r.responded_at),
          responseNote: r.response_note,
          lecturer: { lecturerId: id(r.lecturer_id), fullName: r.lecturer.full_name, facultyName: r.lecturer.faculty_name ?? "" },
          candidateName: app.candidate.full_name,
          applicationId: id(app.application_id),
          applicationCode: app.application_code,
          reviewStatus: app.review_status,
          majorName: app.admission_batch_major.admission_major.major_name,
          researchTopic: r.research_proposal.research_topic,
          researchField: r.research_proposal.research_field,
        };
      }),
    };
  }

  /** Ghi nhận phản hồi của giảng viên (đồng ý / từ chối) và báo cho thí sinh */
  async respond(me: StaffUser, requestId: number, body: Record<string, unknown>) {
    const decision = String(body.decision ?? "");
    const note = String(body.note ?? "").trim().slice(0, 1000);
    if (!["ACCEPTED", "REJECTED"].includes(decision)) fail("VALIDATION", "Chọn kết quả: giảng viên đồng ý hoặc từ chối.");
    if (decision === "REJECTED" && note.length < 5) fail("REASON_REQUIRED", "Ghi lý do từ chối (ít nhất 5 ký tự) để thí sinh chọn giảng viên khác cho phù hợp.");
    const r = await this.prisma.supervisor_request.findUnique({
      where: { request_id: BigInt(requestId) },
      include: { lecturer: true, research_proposal: { include: { application: true } } },
    });
    if (!r) notFound("Không tìm thấy đề nghị hướng dẫn.");
    const app = r.research_proposal.application;
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.supervisor_request.updateMany({
        where: { request_id: r.request_id, status: "PENDING" },
        data: { status: decision, responded_at: new Date(), response_note: note || null },
      });
      if (!u.count) conflict("STALE_STATUS", "Đề nghị này đã được xử lý. Tải lại trang để xem kết quả mới nhất.");
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        decision === "ACCEPTED" ? "SUPERVISOR_ACCEPT" : "SUPERVISOR_REJECT",
        { table: "supervisor_request", id: r.request_id },
        `${app.application_code}: ${r.lecturer.full_name} ${decision === "ACCEPTED" ? "đồng ý" : "từ chối"} hướng dẫn${note ? ` (${note})` : ""}`,
        tx,
      );
      await this.audit.notifyCandidate(
        id(app.candidate_id),
        decision === "ACCEPTED" ? `${r.lecturer.full_name} đồng ý hướng dẫn` : `${r.lecturer.full_name} chưa nhận hướng dẫn`,
        decision === "ACCEPTED"
          ? `Giảng viên ${r.lecturer.full_name} đã đồng ý hướng dẫn đề tài “${r.research_proposal.research_topic}” (hồ sơ ${app.application_code}).${note ? `\nGhi chú: ${note}` : ""}`
          : `Giảng viên ${r.lecturer.full_name} chưa nhận hướng dẫn đề tài của bạn (hồ sơ ${app.application_code}). Lý do: ${note}\nBạn có thể chọn giảng viên khác trong mục “Giảng viên hướng dẫn” trên cổng thí sinh.`,
        tx,
      );
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------- danh mục giảng viên
  async lecturers() {
    const rows = await this.prisma.lecturer.findMany({
      where: { deleted_at: null },
      orderBy: [{ status: "asc" }, { full_name: "asc" }],
      include: { supervisor_request: { select: { status: true } } },
    });
    return rows.map((l) => ({
      lecturerId: id(l.lecturer_id),
      lecturerCode: l.lecturer_code,
      fullName: l.full_name,
      email: l.email,
      facultyName: l.faculty_name ?? "",
      status: l.status,
      accepted: l.supervisor_request.filter((s) => s.status === "ACCEPTED").length,
      pending: l.supervisor_request.filter((s) => s.status === "PENDING").length,
    }));
  }

  private readLecturer(body: Record<string, unknown>) {
    const lecturerCode = String(body.lecturerCode ?? "").trim().toUpperCase();
    const fullName = String(body.fullName ?? "").trim().replace(/\s+/g, " ");
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const facultyName = String(body.facultyName ?? "").trim().replace(/\s+/g, " ") || null;
    if (!/^[A-Z0-9._-]{2,30}$/.test(lecturerCode)) fail("VALIDATION", "Mã giảng viên gồm 2–30 ký tự chữ, số (ví dụ GV-CNTT-01).");
    if (fullName.length < 4 || fullName.length > 255) fail("VALIDATION", "Nhập họ tên kèm học hàm, học vị (ví dụ PGS.TS Nguyễn Văn A).");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("VALIDATION", "Email không hợp lệ.");
    return { lecturerCode, fullName, email, facultyName: facultyName?.slice(0, 255) ?? null };
  }

  private async uniqueCheck(data: { lecturerCode: string; email: string | null }, exceptId?: bigint) {
    const not = exceptId ? { lecturer_id: { not: exceptId } } : {};
    if (await this.prisma.lecturer.count({ where: { lecturer_code: data.lecturerCode, ...not } })) conflict("DUPLICATE_CODE", "Mã giảng viên đã tồn tại.");
    if (data.email && (await this.prisma.lecturer.count({ where: { email: data.email, ...not } }))) conflict("DUPLICATE_EMAIL", "Email đã dùng cho giảng viên khác.");
  }

  async createLecturer(me: StaffUser, body: Record<string, unknown>) {
    const d = this.readLecturer(body);
    await this.uniqueCheck(d);
    const l = await this.prisma.$transaction(async (tx) => {
      const row = await tx.lecturer.create({ data: { lecturer_code: d.lecturerCode, full_name: d.fullName, email: d.email, faculty_name: d.facultyName, status: "ACTIVE" } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "LECTURER_CREATE", { table: "lecturer", id: row.lecturer_id }, `Thêm giảng viên ${d.fullName} (${d.lecturerCode})`, tx);
      return row;
    });
    return { lecturerId: id(l.lecturer_id) };
  }

  async updateLecturer(me: StaffUser, lecturerId: number, body: Record<string, unknown>) {
    const l = await this.prisma.lecturer.findFirst({ where: { lecturer_id: BigInt(lecturerId), deleted_at: null } });
    if (!l) notFound("Không tìm thấy giảng viên.");
    const d = this.readLecturer({ lecturerCode: l.lecturer_code, ...body });
    await this.uniqueCheck(d, l.lecturer_id);
    const status = body.status === undefined ? l.status : String(body.status);
    if (!["ACTIVE", "INACTIVE"].includes(status)) fail("VALIDATION", "Trạng thái không hợp lệ.");
    await this.prisma.$transaction(async (tx) => {
      await tx.lecturer.update({ where: { lecturer_id: l.lecturer_id }, data: { lecturer_code: d.lecturerCode, full_name: d.fullName, email: d.email, faculty_name: d.facultyName, status } });
      const what = status !== l.status ? (status === "ACTIVE" ? "nhận hướng dẫn trở lại" : "ngừng nhận hướng dẫn") : "cập nhật thông tin";
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "LECTURER_UPDATE", { table: "lecturer", id: l.lecturer_id }, `${d.fullName}: ${what}`, tx);
    });
    return { success: true };
  }
}
