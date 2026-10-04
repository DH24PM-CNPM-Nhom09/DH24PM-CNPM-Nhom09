import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { fail, notFound } from "../../common/errors";
import { dec, id, iso, isoReq, str, toInt } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

export const CATEGORIES = ["TUYEN_SINH", "QUY_DINH", "HUONG_DAN", "KET_QUA"] as const;
type Category = (typeof CATEGORIES)[number];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

type Row = Prisma.announcementGetPayload<{ include: { admission_batch: true; staff_account: true } }>;

/** Đoạn trích: đoạn văn đầu tiên (thêm đoạn kế nếu quá ngắn), cắt ở ranh giới từ */
function excerpt(s: string, n = 220) {
  const paras = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let text = paras[0] ?? "";
  if (text.length < 90 && paras[1]) text += " " + paras[1];
  const flat = text.replace(/\n-\s+/g, "; ").replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n).replace(/\s\S*$/, "") + "…" : flat;
}

/**
 * Thông báo tuyển sinh / quy định (bảng announcement, cột category & is_pinned thêm ở migration v5).
 * Thí sinh và khách xem các thông báo PUBLISHED; cán bộ tuyển sinh soạn, đăng, gỡ.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDto(r: Row, full: boolean) {
    return {
      announcementId: id(r.announcement_id),
      title: r.title,
      category: r.category as Category,
      isPinned: r.is_pinned,
      status: r.status,
      publishedAt: iso(r.published_at),
      createdAt: isoReq(r.created_at),
      updatedAt: iso(r.updated_at),
      batch: r.admission_batch ? { batchId: id(r.admission_batch.batch_id), batchName: r.admission_batch.batch_name } : null,
      createdByName: r.staff_account?.full_name ?? null,
      excerpt: excerpt(r.content),
      ...(full ? { content: r.content } : {}),
    };
  }

  // ------------------------------------------------------------------ công khai
  async publicList(q: Record<string, string | undefined>) {
    const page = toInt(q.page, 1);
    const pageSize = Math.min(toInt(q.pageSize, 20), 50);
    const where: Prisma.announcementWhereInput = { status: "PUBLISHED" };
    if (q.category && (CATEGORIES as readonly string[]).includes(q.category)) where.category = q.category;
    if (q.q?.trim()) where.OR = [{ title: { contains: q.q.trim() } }, { content: { contains: q.q.trim() } }];
    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: { admission_batch: true, staff_account: true },
        orderBy: [{ is_pinned: "desc" }, { published_at: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDto(r, false)), total, page, pageSize };
  }

  async publicDetail(announcementId: number) {
    const r = await this.prisma.announcement.findFirst({
      where: { announcement_id: BigInt(announcementId), status: "PUBLISHED" },
      include: { admission_batch: true, staff_account: true },
    });
    if (!r) notFound("Thông báo không tồn tại hoặc đã được gỡ.");
    return this.toDto(r, true);
  }

  /** Các đợt đang mở đăng ký, kèm ngành, chỉ tiêu, điều kiện và hình thức xét tuyển */
  async openBatches() {
    const batches = await this.prisma.admission_batch.findMany({
      where: { status: "OPEN", deleted_at: null },
      orderBy: { registration_end_at: "asc" },
      include: {
        admission_batch_major: {
          where: { status: { in: ["APPROVED", "OPEN"] } },
          include: { admission_major: true, admission_condition: true, exam_subject: true },
          orderBy: { batch_major_id: "asc" },
        },
      },
    });
    return batches.map((b) => ({
      batchId: id(b.batch_id),
      batchCode: b.batch_code,
      batchName: b.batch_name,
      degreeLevel: b.degree_level,
      registrationStartAt: isoReq(b.registration_start_at),
      registrationEndAt: isoReq(b.registration_end_at),
      examStartAt: iso(b.exam_start_at),
      examEndAt: iso(b.exam_end_at),
      legalBasis: b.legal_basis,
      majors: b.admission_batch_major.map((m) => ({
        batchMajorId: id(m.batch_major_id),
        majorCode: m.admission_major.major_code,
        majorName: m.admission_major.major_name,
        facultyName: m.admission_major.faculty_name,
        quota: m.quota,
        conditions: m.admission_condition.map((c) => ({
          description: c.description,
          minGpa: dec(c.min_gpa),
          requiredCertificate: c.required_certificate,
          isMandatory: c.is_mandatory,
        })),
        subjects: m.exam_subject.map((s) => ({ subjectName: s.subject_name, examFormat: s.exam_format, weight: dec(s.weight) })),
      })),
    }));
  }

  // ------------------------------------------------------------------ cán bộ
  async adminList(q: Record<string, string | undefined>) {
    const where: Prisma.announcementWhereInput = {};
    if (q.status && (STATUSES as readonly string[]).includes(q.status)) where.status = q.status;
    if (q.category && (CATEGORIES as readonly string[]).includes(q.category)) where.category = q.category;
    if (q.q?.trim()) where.title = { contains: q.q.trim() };
    const rows = await this.prisma.announcement.findMany({
      where,
      include: { admission_batch: true, staff_account: true },
      orderBy: [{ created_at: "desc" }],
      take: 200,
    });
    return rows.map((r) => this.toDto(r, true));
  }

  private async parse(body: Record<string, unknown>) {
    const title = str(body.title).trim();
    const content = str(body.content).trim();
    const category = str(body.category || "TUYEN_SINH") as Category;
    const isPinned = body.isPinned === true;
    const batchId = body.batchId === null || body.batchId === undefined || body.batchId === "" ? null : Number(body.batchId);
    if (title.length < 10 || title.length > 255) fail("VALIDATION", "Tiêu đề cần từ 10 đến 255 ký tự.");
    if (content.length < 30) fail("VALIDATION", "Nội dung thông báo cần ít nhất 30 ký tự.");
    if (!CATEGORIES.includes(category)) fail("VALIDATION", "Loại thông báo không hợp lệ.");
    if (batchId !== null) {
      if (!Number.isInteger(batchId)) fail("VALIDATION", "Đợt tuyển sinh không hợp lệ.");
      const exists = await this.prisma.admission_batch.count({ where: { batch_id: BigInt(batchId), deleted_at: null } });
      if (!exists) fail("VALIDATION", "Đợt tuyển sinh không tồn tại.");
    }
    return { title, content, category, is_pinned: isPinned, batch_id: batchId === null ? null : BigInt(batchId) };
  }

  async create(me: StaffUser, body: Record<string, unknown>) {
    const data = await this.parse(body);
    const publish = body.publish === true;
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.announcement.create({
        data: { ...data, status: publish ? "PUBLISHED" : "DRAFT", published_at: publish ? new Date() : null, created_by_staff_id: BigInt(me.staffAccountId) },
        include: { admission_batch: true, staff_account: true },
      });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        publish ? "ANNOUNCEMENT_PUBLISH" : "ANNOUNCEMENT_CREATE",
        { table: "announcement", id: r.announcement_id },
        `${publish ? "Đăng" : "Soạn nháp"} thông báo: ${data.title}`,
        tx,
      );
      return r;
    });
    return this.toDto(row, true);
  }

  async update(me: StaffUser, announcementId: number, body: Record<string, unknown>) {
    const existing = await this.prisma.announcement.findUnique({ where: { announcement_id: BigInt(announcementId) } });
    if (!existing) notFound("Không tìm thấy thông báo.");
    const data = await this.parse(body);
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.announcement.update({
        where: { announcement_id: existing.announcement_id },
        data: { ...data, updated_at: new Date() },
        include: { admission_batch: true, staff_account: true },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ANNOUNCEMENT_UPDATE", { table: "announcement", id: r.announcement_id }, `Sửa thông báo: ${data.title}`, tx);
      return r;
    });
    return this.toDto(row, true);
  }

  async setStatus(me: StaffUser, announcementId: number, statusRaw: string) {
    const status = str(statusRaw);
    if (!(STATUSES as readonly string[]).includes(status)) fail("VALIDATION", "Trạng thái không hợp lệ.");
    const existing = await this.prisma.announcement.findUnique({ where: { announcement_id: BigInt(announcementId) } });
    if (!existing) notFound("Không tìm thấy thông báo.");
    if (existing.status === status) fail("NO_CHANGE", "Thông báo đã ở trạng thái này.");
    const label = { PUBLISHED: "Đăng", ARCHIVED: "Gỡ", DRAFT: "Chuyển về nháp" }[status as (typeof STATUSES)[number]];
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.announcement.update({
        where: { announcement_id: existing.announcement_id },
        // Đăng lại sau khi gỡ thì giữ ngày đăng đầu tiên
        data: { status, ...(status === "PUBLISHED" && !existing.published_at ? { published_at: new Date() } : {}), updated_at: new Date() },
        include: { admission_batch: true, staff_account: true },
      });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        `ANNOUNCEMENT_${status}`,
        { table: "announcement", id: r.announcement_id },
        `${label} thông báo: ${existing.title}`,
        tx,
      );
      return r;
    });
    return this.toDto(row, true);
  }
}
