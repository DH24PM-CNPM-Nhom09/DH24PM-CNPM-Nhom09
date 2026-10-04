import { HttpStatus, Injectable } from "@nestjs/common";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id, str } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";
import { toBatchDto, toBatchMajorDto, toMajorDto } from "./mappers";

type BatchStatus = "DRAFT" | "OPEN" | "CLOSED" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";

/** Vòng đời đợt tuyển sinh (UC-CB-06 và tài liệu Vai trò người dùng mục 3.3.A) */
const BATCH_FLOW: Record<BatchStatus, BatchStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED"],
  CLOSED: ["IN_REVIEW"],
  IN_REVIEW: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
const BATCH_VI: Record<BatchStatus, string> = {
  DRAFT: "Nháp",
  OPEN: "Mở đăng ký",
  CLOSED: "Đóng đăng ký",
  IN_REVIEW: "Xét kết quả",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy",
};
const EXAM_FORMATS = ["THI_VIET", "PHONG_VAN", "XET_HO_SO"];

/** Làm tròn 2 chữ số để so tổng trọng số = 1.00 không lệch do số thực */
const sumWeights = (ws: number[]) => Math.round(ws.reduce((s, w) => s + w, 0) * 100) / 100;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const batches = await this.prisma.admission_batch.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: "desc" },
      include: { admission_batch_major: { include: { _count: { select: { application: { where: { is_cancelled: false, deleted_at: null, review_status: { not: "DRAFT" } } } } } } } },
    });
    return batches.map((b) => ({
      ...toBatchDto(b),
      majorCount: b.admission_batch_major.length,
      quotaTotal: b.admission_batch_major.reduce((s, x) => s + x.quota, 0),
      applicationCount: b.admission_batch_major.reduce((s, x) => s + x._count.application, 0),
    }));
  }

  private async load(batchId: number) {
    const batch = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!batch) notFound("Không tìm thấy đợt tuyển sinh.");
    return batch;
  }

  async detail(batchId: number) {
    const batch = await this.load(batchId);
    const [bms, allMajors, staff, grouped] = await Promise.all([
      this.prisma.admission_batch_major.findMany({
        where: { batch_id: batch.batch_id },
        include: { exam_subject: { orderBy: { subject_id: "asc" } }, admission_condition: true, admission_major: true },
        orderBy: { batch_major_id: "asc" },
      }),
      this.prisma.admission_major.findMany({ where: { deleted_at: null, status: "ACTIVE" }, orderBy: { major_name: "asc" } }),
      this.prisma.staff_account.findMany({ select: { staff_account_id: true, full_name: true } }),
      this.prisma.application.groupBy({
        by: ["batch_major_id", "review_status"],
        where: { admission_batch_major: { batch_id: batch.batch_id }, is_cancelled: false, deleted_at: null, review_status: { not: "DRAFT" } },
        _count: { _all: true },
      }),
    ]);
    const countOf = (bmId: bigint, statuses?: string[]) =>
      grouped.filter((g) => g.batch_major_id === bmId && (!statuses || statuses.includes(g.review_status))).reduce((s, g) => s + g._count._all, 0);
    return {
      batch: toBatchDto(batch),
      unresolvedCount: grouped.filter((g) => ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"].includes(g.review_status)).reduce((s, g) => s + g._count._all, 0),
      allMajors: allMajors.map(toMajorDto),
      staffNames: Object.fromEntries(staff.map((s) => [id(s.staff_account_id), s.full_name])),
      majors: bms.map((bm) => ({
        ...toBatchMajorDto(bm),
        major: toMajorDto(bm.admission_major),
        applicationCount: countOf(bm.batch_major_id),
        approvedCount: countOf(bm.batch_major_id, ["APPROVED"]),
      })),
    };
  }

  async create(me: StaffUser, dto: Record<string, unknown>) {
    const code = str(dto.batchCode).trim().toUpperCase();
    const name = str(dto.batchName).trim();
    const degree = str(dto.degreeLevel);
    const regStart = new Date(str(dto.registrationStartAt));
    const regEnd = new Date(str(dto.registrationEndAt));
    const examStart = dto.examStartAt ? new Date(str(dto.examStartAt)) : null;
    const examEnd = dto.examEndAt ? new Date(str(dto.examEndAt)) : null;
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) fail("INVALID_CODE", "Mã đợt chỉ gồm chữ in hoa, số và dấu gạch ngang (3–30 ký tự).");
    if (name.length < 5) fail("NAME_REQUIRED", "Nhập tên đợt tuyển sinh.");
    if (!["THAC_SI", "TIEN_SI"].includes(degree)) fail("VALIDATION", "Bậc đào tạo không hợp lệ.");
    if (Number.isNaN(regStart.getTime()) || Number.isNaN(regEnd.getTime())) fail("INVALID_DATES", "Nhập đủ thời gian mở và đóng đăng ký.");
    if (regEnd <= regStart) fail("INVALID_DATES", "Ngày kết thúc đăng ký phải sau ngày bắt đầu.");
    if (examStart && examStart <= regEnd) fail("INVALID_DATES", "Ngày thi phải sau khi đóng đăng ký.");
    if (examStart && examEnd && examEnd < examStart) fail("INVALID_DATES", "Ngày kết thúc thi phải sau ngày bắt đầu thi.");
    if (await this.prisma.admission_batch.count({ where: { batch_code: code } })) conflict("DUPLICATE_CODE", `Mã đợt ${code} đã tồn tại.`);

    const batch = await this.prisma.$transaction(async (tx) => {
      const b = await tx.admission_batch.create({
        data: {
          batch_code: code,
          batch_name: name,
          degree_level: degree,
          registration_start_at: regStart,
          registration_end_at: regEnd,
          exam_start_at: examStart,
          exam_end_at: examEnd,
          legal_basis: str(dto.legalBasis).trim() || null,
        },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "BATCH_CREATE", { table: "admission_batch", id: b.batch_id }, `Tạo đợt ${code}`, tx);
      return b;
    });
    return toBatchDto(batch);
  }

  async changeStatus(me: StaffUser, batchId: number, to: string) {
    const batch = await this.load(batchId);
    const from = batch.status as BatchStatus;
    if (!BATCH_FLOW[from]?.includes(to as BatchStatus)) fail("INVALID_TRANSITION", "Không thể chuyển đợt sang trạng thái này.", HttpStatus.CONFLICT);
    const detail = await this.detail(batchId);
    const issues: string[] = [];
    if (to === "OPEN") {
      if (detail.majors.length === 0) issues.push("Đợt chưa có ngành tuyển sinh nào.");
      detail.majors.forEach((m) => {
        if (m.status === "CONFIGURING") issues.push(`${m.major.majorName}: chưa được lãnh đạo phê duyệt chỉ tiêu.`);
        const s = sumWeights(m.subjects.map((x) => x.weight));
        if (s !== 1) issues.push(`${m.major.majorName}: tổng trọng số môn thi là ${Math.round(s * 100)}%, cần đúng 100%.`);
      });
      if (batch.registration_end_at.getTime() < Date.now()) issues.push("Thời hạn đăng ký đã qua, cập nhật lại lịch trước khi mở.");
    }
    if (to === "IN_REVIEW" && detail.unresolvedCount > 0) issues.push(`Còn ${detail.unresolvedCount} hồ sơ chưa có kết luận thẩm định.`);
    if (issues.length) fail("PRECONDITION_FAILED", issues.join(" "), HttpStatus.CONFLICT);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.admission_batch.updateMany({ where: { batch_id: batch.batch_id, status: from }, data: { status: to } });
      if (res.count === 0) conflict("STALE_STATUS", "Đợt vừa được người khác cập nhật, tải lại trang.");
      if (to === "OPEN") await tx.admission_batch_major.updateMany({ where: { batch_id: batch.batch_id, status: "APPROVED" }, data: { status: "OPEN" } });
      if (to === "CLOSED") await tx.admission_batch_major.updateMany({ where: { batch_id: batch.batch_id, status: "OPEN" }, data: { status: "CLOSED" } });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "BATCH_STATUS_CHANGE",
        { table: "admission_batch", id: batch.batch_id },
        `${batch.batch_code}: ${BATCH_VI[from]} → ${BATCH_VI[to as BatchStatus]}`,
        tx,
      );
    });
    return { success: true };
  }

  async addMajor(me: StaffUser, batchId: number, majorId: number, quota: number) {
    const batch = await this.load(batchId);
    if (batch.status !== "DRAFT") fail("INVALID_STATE", "Chỉ thêm ngành khi đợt đang ở trạng thái Nháp.");
    const major = await this.prisma.admission_major.findFirst({ where: { major_id: BigInt(majorId), deleted_at: null } });
    if (!major) notFound("Không tìm thấy ngành.");
    if (major.status !== "ACTIVE") fail("MAJOR_INACTIVE", "Ngành này đang ngừng tuyển sinh trong Danh mục ngành.");
    if (major.degree_level !== batch.degree_level) fail("DEGREE_MISMATCH", "Ngành không cùng bậc đào tạo với đợt.");
    if (!Number.isInteger(quota) || quota <= 0) fail("INVALID_QUOTA", "Chỉ tiêu phải là số nguyên dương.");
    if (await this.prisma.admission_batch_major.count({ where: { batch_id: batch.batch_id, major_id: major.major_id } })) conflict("DUPLICATE", "Ngành đã có trong đợt.");
    const isPhd = batch.degree_level === "TIEN_SI";
    await this.prisma.$transaction(async (tx) => {
      const bm = await tx.admission_batch_major.create({ data: { batch_id: batch.batch_id, major_id: major.major_id, quota } });
      // 2 hình thức xét mặc định để cán bộ chỉnh lại; tổng 100%
      await tx.exam_subject.createMany({
        data: [
          { batch_major_id: bm.batch_major_id, subject_name: isPhd ? "Đánh giá hồ sơ và đề cương nghiên cứu" : "Đánh giá hồ sơ học thuật", exam_format: "XET_HO_SO", weight: isPhd ? 0.6 : 0.4 },
          { batch_major_id: bm.batch_major_id, subject_name: isPhd ? "Trình bày đề cương trước tiểu ban" : "Phỏng vấn chuyên môn", exam_format: "PHONG_VAN", weight: isPhd ? 0.4 : 0.6 },
        ],
      });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "BATCH_MAJOR_ADD",
        { table: "admission_batch_major", id: bm.batch_major_id },
        `${batch.batch_code}: thêm ngành ${major.major_name}, chỉ tiêu ${quota}`,
        tx,
      );
    });
    return { success: true };
  }

  /** Sửa chỉ tiêu + môn thi. Sửa xong phải được lãnh đạo duyệt lại. */
  async updateMajor(me: StaffUser, batchMajorId: number, body: Record<string, unknown>) {
    const bm = await this.prisma.admission_batch_major.findUnique({
      where: { batch_major_id: BigInt(batchMajorId) },
      include: { admission_batch: true, exam_subject: true },
    });
    if (!bm) notFound("Không tìm thấy cấu hình ngành.");
    if (bm.admission_batch.status !== "DRAFT") fail("INVALID_STATE", "Đợt đã mở, không thể sửa chỉ tiêu và môn thi.");
    const quota = Number(body.quota);
    if (!Number.isInteger(quota) || quota <= 0) fail("INVALID_QUOTA", "Chỉ tiêu phải là số nguyên dương.");
    const subjects = Array.isArray(body.subjects) ? (body.subjects as Record<string, unknown>[]) : [];
    if (subjects.length === 0) fail("SUBJECTS_REQUIRED", "Cần ít nhất 1 môn thi / hình thức xét.");
    const clean = subjects.map((s) => ({
      subjectId: s.subjectId ? Number(s.subjectId) : null,
      name: str(s.subjectName).trim(),
      format: str(s.examFormat),
      weight: Math.round(Number(s.weight) * 100) / 100,
      maxScore: Number(s.maxScore) || 10,
    }));
    if (clean.some((s) => !s.name || !(s.weight > 0) || s.weight > 1)) fail("INVALID_SUBJECT", "Mỗi môn cần có tên và trọng số trong khoảng 1–100%.");
    if (clean.some((s) => !EXAM_FORMATS.includes(s.format))) fail("INVALID_SUBJECT", "Hình thức thi không hợp lệ.");
    if (clean.some((s) => s.maxScore <= 0 || s.maxScore > 99)) fail("INVALID_SUBJECT", "Thang điểm không hợp lệ.");

    const existingIds = new Set(bm.exam_subject.map((s) => id(s.subject_id)));
    const keepIds = new Set(clean.filter((s) => s.subjectId && existingIds.has(s.subjectId)).map((s) => s.subjectId!));
    const removeIds = [...existingIds].filter((x) => !keepIds.has(x));
    if (removeIds.length) {
      const used = await this.prisma.exam_score.count({ where: { subject_id: { in: removeIds.map(BigInt) } } });
      if (used) fail("SUBJECT_IN_USE", "Không thể bỏ môn đã có điểm thi.");
    }
    const wasApproved = bm.status === "APPROVED";
    const sum = sumWeights(clean.map((s) => s.weight));

    await this.prisma.$transaction(async (tx) => {
      await tx.admission_batch_major.update({
        where: { batch_major_id: bm.batch_major_id },
        data: { quota, status: "CONFIGURING", approved_by_staff_id: null, approved_at: null },
      });
      if (removeIds.length) await tx.exam_subject.deleteMany({ where: { subject_id: { in: removeIds.map(BigInt) } } });
      for (const s of clean) {
        const data = { subject_name: s.name, exam_format: s.format, weight: s.weight, max_score: s.maxScore };
        if (s.subjectId && keepIds.has(s.subjectId)) await tx.exam_subject.update({ where: { subject_id: BigInt(s.subjectId) }, data });
        else await tx.exam_subject.create({ data: { ...data, batch_major_id: bm.batch_major_id } });
      }
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "BATCH_MAJOR_UPDATE",
        { table: "admission_batch_major", id: bm.batch_major_id },
        `Cập nhật chỉ tiêu ${quota}, trọng số ${Math.round(sum * 100)}%${wasApproved ? " (cần duyệt lại)" : ""}`,
        tx,
      );
    });
    return { success: true, needsReapproval: wasApproved };
  }

  async approveMajor(me: StaffUser, batchMajorId: number) {
    const bm = await this.prisma.admission_batch_major.findUnique({
      where: { batch_major_id: BigInt(batchMajorId) },
      include: { exam_subject: true, admission_major: true },
    });
    if (!bm) notFound("Không tìm thấy cấu hình ngành.");
    if (bm.status !== "CONFIGURING") fail("INVALID_STATE", "Ngành này không ở trạng thái chờ duyệt.");
    const sum = sumWeights(bm.exam_subject.map((s) => Number(s.weight)));
    if (sum !== 1) fail("WEIGHT_SUM_INVALID", `Tổng trọng số môn thi đang là ${Math.round(sum * 100)}%, cần đúng 100% mới phê duyệt được.`);
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.admission_batch_major.updateMany({
        where: { batch_major_id: bm.batch_major_id, status: "CONFIGURING" },
        data: { status: "APPROVED", approved_by_staff_id: BigInt(me.staffAccountId), approved_at: new Date() },
      });
      if (res.count === 0) conflict("STALE_STATUS", "Cấu hình vừa thay đổi, tải lại trang.");
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "BATCH_MAJOR_APPROVE",
        { table: "admission_batch_major", id: bm.batch_major_id },
        `Phê duyệt chỉ tiêu ${bm.admission_major.major_name}: ${bm.quota}`,
        tx,
      );
    });
    return { success: true };
  }
}
