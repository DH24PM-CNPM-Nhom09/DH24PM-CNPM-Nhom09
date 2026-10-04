import { HttpStatus, Injectable } from "@nestjs/common";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { id } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Danh mục ngành đào tạo sau đại học (bảng admission_major).
 * Cán bộ tuyển sinh thêm / sửa ngành rồi mới gắn ngành vào từng đợt tuyển sinh.
 * Ngành đã dùng trong đợt thì không đổi mã, không đổi bậc; chỉ "ngừng tuyển" (status INACTIVE), không xóa.
 */
@Injectable()
export class MajorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.admission_major.findMany({
      where: { deleted_at: null },
      orderBy: [{ degree_level: "asc" }, { major_name: "asc" }],
      include: { admission_batch_major: { select: { _count: { select: { application: { where: { is_cancelled: false, review_status: { not: "DRAFT" } } } } } } } },
    });
    return rows.map((m) => ({
      majorId: id(m.major_id),
      majorCode: m.major_code,
      majorName: m.major_name,
      degreeLevel: m.degree_level,
      facultyName: m.faculty_name ?? "",
      status: m.status,
      batchCount: m.admission_batch_major.length,
      applicationCount: m.admission_batch_major.reduce((t, b) => t + b._count.application, 0),
    }));
  }

  private read(body: Record<string, unknown>) {
    const majorCode = String(body.majorCode ?? "").trim().toUpperCase();
    const majorName = String(body.majorName ?? "").trim().replace(/\s+/g, " ");
    const degreeLevel = String(body.degreeLevel ?? "");
    const facultyName = String(body.facultyName ?? "").trim().replace(/\s+/g, " ") || null;
    if (!/^[0-9A-Z]{4,20}$/.test(majorCode)) fail("VALIDATION", "Mã ngành gồm 4–20 chữ số hoặc chữ cái (theo danh mục của Bộ GD&ĐT, ví dụ 8340101).");
    if (majorName.length < 3 || majorName.length > 255) fail("VALIDATION", "Tên ngành cần từ 3 đến 255 ký tự.");
    if (!["THAC_SI", "TIEN_SI"].includes(degreeLevel)) fail("VALIDATION", "Chọn bậc đào tạo: thạc sĩ hoặc tiến sĩ.");
    return { majorCode, majorName, degreeLevel, facultyName: facultyName?.slice(0, 255) ?? null };
  }

  async create(me: StaffUser, body: Record<string, unknown>) {
    const v = this.read(body);
    if (await this.prisma.admission_major.count({ where: { major_code: v.majorCode } })) conflict("DUPLICATE_CODE", `Mã ngành ${v.majorCode} đã có trong danh mục.`);
    const m = await this.prisma.$transaction(async (tx) => {
      const row = await tx.admission_major.create({
        data: { major_code: v.majorCode, major_name: v.majorName, degree_level: v.degreeLevel, faculty_name: v.facultyName, status: "ACTIVE" },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "MAJOR_CREATE", { table: "admission_major", id: row.major_id }, `Thêm ngành ${v.majorCode} ${v.majorName} (${v.degreeLevel === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ"})`, tx);
      return row;
    });
    return { majorId: id(m.major_id) };
  }

  async update(me: StaffUser, majorId: number, body: Record<string, unknown>) {
    const m = await this.prisma.admission_major.findFirst({ where: { major_id: BigInt(majorId), deleted_at: null }, include: { _count: { select: { admission_batch_major: true } } } });
    if (!m) notFound("Không tìm thấy ngành.");
    const v = this.read({ majorCode: body.majorCode ?? m.major_code, majorName: body.majorName ?? m.major_name, degreeLevel: body.degreeLevel ?? m.degree_level, facultyName: body.facultyName ?? m.faculty_name });
    const used = m._count.admission_batch_major > 0;
    if (used && (v.majorCode !== m.major_code || v.degreeLevel !== m.degree_level))
      fail("MAJOR_IN_USE", "Ngành đã được mở trong đợt tuyển sinh nên không đổi được mã ngành hay bậc đào tạo.", HttpStatus.CONFLICT);
    if (v.majorCode !== m.major_code && (await this.prisma.admission_major.count({ where: { major_code: v.majorCode } }))) conflict("DUPLICATE_CODE", `Mã ngành ${v.majorCode} đã có trong danh mục.`);
    const status = body.status === undefined ? m.status : String(body.status);
    if (!["ACTIVE", "INACTIVE"].includes(status)) fail("VALIDATION", "Trạng thái không hợp lệ.");
    const changes: string[] = [];
    if (v.majorName !== m.major_name) changes.push(`tên “${m.major_name}” → “${v.majorName}”`);
    if (v.majorCode !== m.major_code) changes.push(`mã ${m.major_code} → ${v.majorCode}`);
    if ((v.facultyName ?? "") !== (m.faculty_name ?? "")) changes.push(`khoa: ${v.facultyName ?? "—"}`);
    if (status !== m.status) changes.push(status === "ACTIVE" ? "tuyển sinh lại" : "ngừng tuyển sinh");
    if (!changes.length) return { success: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.admission_major.update({
        where: { major_id: m.major_id },
        data: { major_code: v.majorCode, major_name: v.majorName, degree_level: v.degreeLevel, faculty_name: v.facultyName, status },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "MAJOR_UPDATE", { table: "admission_major", id: m.major_id }, `Ngành ${m.major_code}: ${changes.join(", ")}`, tx);
    });
    return { success: true };
  }
}
