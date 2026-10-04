import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { conflict, fail, notFound } from "../../common/errors";
import { dec, id, isoReq, ymd } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

/** Hồ sơ đã nộp và chưa bị loại thì mới xếp thi */
const ACTIVE_REVIEW = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT", "APPROVED"];
const RESULTS = ["PENDING", "PASSED", "FAILED", "ABSENT"] as const;
type Result = (typeof RESULTS)[number];
export const ENGLISH_RESULT_VI: Record<Result, string> = { PENDING: "Chưa có kết quả", PASSED: "Đạt", FAILED: "Không đạt", ABSENT: "Vắng thi" };

const vnTime = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Thi đánh giá năng lực tiếng Anh — CHỈ cho thí sinh chưa có chứng chỉ ngoại ngữ đạt chuẩn
 * và không thuộc diện miễn (đã chọn "đăng ký dự thi", application.language_option = 'TEST').
 * Cán bộ tạo buổi thi → xếp phòng tự động (cấp số báo danh, ghế, báo lịch) → nhập kết quả.
 * Hồ sơ đăng ký thi mà chưa Đạt thì không kết luận "Đạt thẩm định" được (review-rules).
 */
@Injectable()
export class EnglishTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private eligibleWhere(batchId: bigint): Prisma.applicationWhereInput {
    return {
      language_option: "TEST",
      is_cancelled: false,
      deleted_at: null,
      review_status: { in: ACTIVE_REVIEW },
      admission_batch_major: { batch_id: batchId },
    };
  }

  /** Các đợt có thí sinh đăng ký thi tiếng Anh (cho ô chọn đợt) */
  async batches() {
    const rows = await this.prisma.admission_batch.findMany({ where: { deleted_at: null }, orderBy: { batch_id: "desc" } });
    const out = [];
    for (const b of rows) {
      const total = await this.prisma.application.count({ where: this.eligibleWhere(b.batch_id) });
      out.push({ batchId: id(b.batch_id), batchCode: b.batch_code, batchName: b.batch_name, status: b.status, candidates: total });
    }
    return out;
  }

  async overview(batchId: number) {
    const b = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!b) notFound("Không tìm thấy đợt tuyển sinh.");
    const [sessions, apps] = await Promise.all([
      this.prisma.english_test_session.findMany({
        where: { batch_id: b.batch_id },
        orderBy: [{ test_at: "asc" }, { session_code: "asc" }],
        include: { english_test_registration: { select: { result: true } } },
      }),
      this.prisma.application.findMany({
        where: this.eligibleWhere(b.batch_id),
        orderBy: { application_code: "asc" },
        include: {
          candidate: true,
          application_payment: { select: { gateway_status: true } },
          admission_batch_major: { include: { admission_major: true } },
          english_test_registration: { include: { english_test_session: true } },
        },
      }),
    ]);
    const candidates = apps.map((a) => {
      const r = a.english_test_registration;
      return {
        applicationId: id(a.application_id),
        applicationCode: a.application_code,
        fullName: a.candidate.full_name,
        dob: ymd(a.candidate.dob),
        idNumber: a.candidate.id_number,
        majorName: a.admission_batch_major.admission_major.major_name,
        reviewStatus: a.review_status,
        paid: a.application_payment.some((p) => p.gateway_status === "SUCCESS"),
        registration: r
          ? {
              sessionId: id(r.session_id),
              sessionCode: r.english_test_session.session_code,
              candidateNumber: r.candidate_number,
              seatNo: r.seat_no,
              result: r.result as Result,
              score: dec(r.score),
              note: r.note,
            }
          : null,
      };
    });
    return {
      batch: { batchId: id(b.batch_id), batchCode: b.batch_code, batchName: b.batch_name },
      sessions: sessions.map((s) => ({
        sessionId: id(s.session_id),
        sessionCode: s.session_code,
        testAt: isoReq(s.test_at),
        room: s.room,
        location: s.location,
        capacity: s.capacity,
        note: s.note,
        status: s.status,
        assigned: s.english_test_registration.length,
        graded: s.english_test_registration.filter((r) => r.result !== "PENDING").length,
      })),
      candidates,
      stats: {
        total: candidates.length,
        assigned: candidates.filter((c) => c.registration).length,
        unpaidUnassigned: candidates.filter((c) => !c.registration && !c.paid).length,
        passed: candidates.filter((c) => c.registration?.result === "PASSED").length,
        failed: candidates.filter((c) => c.registration?.result === "FAILED").length,
        absent: candidates.filter((c) => c.registration?.result === "ABSENT").length,
      },
    };
  }

  // ---------------------------------------------------------------------- buổi thi
  private readSession(body: Record<string, unknown>) {
    const sessionCode = String(body.sessionCode ?? "").trim().toUpperCase();
    const room = String(body.room ?? "").trim().replace(/\s+/g, " ");
    const location = String(body.location ?? "").trim().replace(/\s+/g, " ") || null;
    const note = String(body.note ?? "").trim().slice(0, 500) || null;
    const capacity = Number(body.capacity);
    const testAt = new Date(String(body.testAt ?? ""));
    if (!/^[A-Z0-9._-]{1,30}$/.test(sessionCode)) fail("VALIDATION", "Mã phòng thi gồm chữ, số (ví dụ TA-01).");
    if (room.length < 1 || room.length > 100) fail("VALIDATION", "Nhập phòng thi (ví dụ: Phòng B2-101).");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) fail("VALIDATION", "Sức chứa từ 1 đến 500 thí sinh.");
    if (Number.isNaN(testAt.getTime())) fail("VALIDATION", "Chọn ngày giờ thi.");
    return { sessionCode, room, location: location?.slice(0, 255) ?? null, note, capacity, testAt };
  }

  async createSession(me: StaffUser, batchId: number, body: Record<string, unknown>) {
    const b = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!b) notFound("Không tìm thấy đợt tuyển sinh.");
    const d = this.readSession(body);
    if (d.testAt.getTime() < Date.now()) fail("VALIDATION", "Ngày giờ thi phải ở tương lai.");
    if (await this.prisma.english_test_session.count({ where: { batch_id: b.batch_id, session_code: d.sessionCode } })) conflict("DUPLICATE_CODE", `Đợt này đã có phòng thi ${d.sessionCode}.`);
    const s = await this.prisma.$transaction(async (tx) => {
      const row = await tx.english_test_session.create({
        data: { batch_id: b.batch_id, session_code: d.sessionCode, test_at: d.testAt, room: d.room, location: d.location, capacity: d.capacity, note: d.note },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_SESSION_CREATE", { table: "english_test_session", id: row.session_id }, `${b.batch_code}: tạo phòng thi tiếng Anh ${d.sessionCode} (${d.room}, ${vnTime(d.testAt)}, ${d.capacity} chỗ)`, tx);
      return row;
    });
    return { sessionId: id(s.session_id) };
  }

  async updateSession(me: StaffUser, sessionId: number, body: Record<string, unknown>) {
    const s = await this.prisma.english_test_session.findUnique({ where: { session_id: BigInt(sessionId) }, include: { english_test_registration: true, admission_batch: true } });
    if (!s) notFound("Không tìm thấy phòng thi.");
    if (body.status === "CANCELLED") {
      if (s.english_test_registration.length) conflict("SESSION_NOT_EMPTY", "Phòng thi đã có thí sinh. Chuyển hết thí sinh sang phòng khác trước khi hủy.");
      await this.prisma.$transaction(async (tx) => {
        await tx.english_test_session.update({ where: { session_id: s.session_id }, data: { status: "CANCELLED" } });
        await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_SESSION_UPDATE", { table: "english_test_session", id: s.session_id }, `${s.admission_batch.batch_code}: hủy phòng thi ${s.session_code}`, tx);
      });
      return { success: true };
    }
    const d = this.readSession({ sessionCode: s.session_code, ...body });
    if (d.capacity < s.english_test_registration.length) fail("VALIDATION", `Phòng đã xếp ${s.english_test_registration.length} thí sinh, sức chứa không được nhỏ hơn số này.`);
    if (d.sessionCode !== s.session_code && (await this.prisma.english_test_session.count({ where: { batch_id: s.batch_id, session_code: d.sessionCode } })))
      conflict("DUPLICATE_CODE", `Đợt này đã có phòng thi ${d.sessionCode}.`);
    const timeChanged = d.testAt.getTime() !== s.test_at.getTime() || d.room !== s.room || d.location !== s.location;
    await this.prisma.$transaction(async (tx) => {
      await tx.english_test_session.update({
        where: { session_id: s.session_id },
        data: { session_code: d.sessionCode, test_at: d.testAt, room: d.room, location: d.location, capacity: d.capacity, note: d.note, status: s.status === "CANCELLED" ? "SCHEDULED" : s.status },
      });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_SESSION_UPDATE", { table: "english_test_session", id: s.session_id }, `${s.admission_batch.batch_code}: cập nhật phòng thi ${d.sessionCode}`, tx);
      // Đổi giờ / phòng: báo lại cho thí sinh đã xếp
      if (timeChanged)
        for (const r of s.english_test_registration) {
          const app = await tx.application.findUniqueOrThrow({ where: { application_id: r.application_id } });
          await this.audit.notifyCandidate(
            id(app.candidate_id),
            "Thay đổi lịch thi đánh giá năng lực tiếng Anh",
            `Lịch thi của bạn (số báo danh ${r.candidate_number}) đã thay đổi: ${vnTime(d.testAt)}, ${d.room}${d.location ? `, ${d.location}` : ""}. Vui lòng xem và in lại giấy báo dự thi trên cổng thí sinh.`,
            tx,
          );
        }
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------- xếp phòng
  private async nextNumber(tx: Prisma.TransactionClient, batchId: bigint, batchCode: string) {
    const prefix = `${batchCode}-TA-`;
    const last = await tx.english_test_registration.findFirst({ where: { candidate_number: { startsWith: prefix }, english_test_session: { batch_id: batchId } }, orderBy: { candidate_number: "desc" } });
    const n = last ? Number(last.candidate_number.slice(prefix.length)) || 0 : 0;
    return { prefix, n };
  }

  private async notifySchedule(tx: Prisma.TransactionClient, candidateId: bigint, num: string, seat: number, s: { test_at: Date; room: string; location: string | null; session_code: string; note: string | null }) {
    await this.audit.notifyCandidate(
      id(candidateId),
      "Lịch thi đánh giá năng lực tiếng Anh",
      `Số báo danh: ${num} — ghế ${seat}\nThời gian: ${vnTime(s.test_at)}\nPhòng thi: ${s.room} (${s.session_code})${s.location ? `\nĐịa điểm: ${s.location}` : ""}${s.note ? `\nLưu ý: ${s.note}` : ""}\nMang theo CCCD bản gốc và giấy báo dự thi (in từ cổng thí sinh), có mặt trước giờ thi 30 phút.`,
      tx,
    );
  }

  /** Xếp tự động thí sinh chưa có phòng vào các phòng còn chỗ (theo giờ thi), cấp số báo danh, báo lịch */
  async autoAssign(me: StaffUser, batchId: number, body: Record<string, unknown>) {
    const paidOnly = body.paidOnly !== false;
    const b = await this.prisma.admission_batch.findFirst({ where: { batch_id: BigInt(batchId), deleted_at: null } });
    if (!b) notFound("Không tìm thấy đợt tuyển sinh.");
    return this.prisma.$transaction(
      async (tx) => {
        const sessions = await tx.english_test_session.findMany({
          where: { batch_id: b.batch_id, status: "SCHEDULED", test_at: { gt: new Date() } },
          orderBy: [{ test_at: "asc" }, { session_code: "asc" }],
          include: { english_test_registration: { select: { seat_no: true } } },
        });
        if (!sessions.length) fail("NO_SESSION", "Chưa có phòng thi nào sắp diễn ra. Tạo phòng thi trước khi xếp.", HttpStatus.CONFLICT);
        const waiting = await tx.application.findMany({
          where: {
            ...this.eligibleWhere(b.batch_id),
            english_test_registration: { is: null },
            ...(paidOnly ? { application_payment: { some: { gateway_status: "SUCCESS" } } } : {}),
          },
          include: { candidate: true, admission_batch_major: { include: { admission_major: true } } },
        });
        // Xếp theo ngành rồi theo tên (tiếng Việt) để danh sách phòng dễ tra
        waiting.sort(
          (x, y) =>
            x.admission_batch_major.admission_major.major_name.localeCompare(y.admission_batch_major.admission_major.major_name, "vi") ||
            (x.candidate.full_name.split(" ").pop() ?? "").localeCompare(y.candidate.full_name.split(" ").pop() ?? "", "vi") ||
            x.candidate.full_name.localeCompare(y.candidate.full_name, "vi"),
        );
        let { prefix, n } = await this.nextNumber(tx, b.batch_id, b.batch_code);
        let assigned = 0;
        let si = 0;
        const seats = sessions.map((s) => ({ s, used: s.english_test_registration.length, next: Math.max(0, ...s.english_test_registration.map((r) => r.seat_no)) + 1 }));
        for (const a of waiting) {
          while (si < seats.length && seats[si].used >= seats[si].s.capacity) si++;
          if (si >= seats.length) break;
          const slot = seats[si];
          n += 1;
          const num = `${prefix}${String(n).padStart(4, "0")}`;
          const seat = slot.next++;
          slot.used++;
          await tx.english_test_registration.create({ data: { application_id: a.application_id, session_id: slot.s.session_id, candidate_number: num, seat_no: seat } });
          await this.notifySchedule(tx, a.candidate_id, num, seat, slot.s);
          assigned++;
        }
        const left = waiting.length - assigned;
        if (assigned)
          await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_ASSIGN", { table: "english_test_session", id: null }, `${b.batch_code}: xếp ${assigned} thí sinh vào phòng thi tiếng Anh${left ? `, còn ${left} chưa đủ chỗ` : ""}`, tx);
        return { assigned, notEnoughSeats: left };
      },
      { timeout: 60_000 },
    );
  }

  /** Chuyển một thí sinh sang phòng khác (giữ số báo danh, cấp ghế mới) */
  async move(me: StaffUser, applicationId: number, sessionId: number) {
    const r = await this.prisma.english_test_registration.findUnique({
      where: { application_id: BigInt(applicationId) },
      include: { english_test_session: true, application: true },
    });
    if (!r) notFound("Thí sinh chưa được xếp phòng.");
    if (r.result !== "PENDING") fail("ALREADY_GRADED", "Thí sinh đã có kết quả thi, không chuyển phòng được.", HttpStatus.CONFLICT);
    const to = await this.prisma.english_test_session.findUnique({ where: { session_id: BigInt(sessionId) }, include: { english_test_registration: { select: { seat_no: true } } } });
    if (!to || to.batch_id !== r.english_test_session.batch_id || to.status !== "SCHEDULED") fail("VALIDATION", "Phòng thi không hợp lệ.");
    if (to.session_id === r.session_id) return { success: true };
    if (to.english_test_registration.length >= to.capacity) conflict("ROOM_FULL", `Phòng ${to.session_code} đã đủ ${to.capacity} chỗ.`);
    const seat = Math.max(0, ...to.english_test_registration.map((x) => x.seat_no)) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.english_test_registration.update({ where: { registration_id: r.registration_id }, data: { session_id: to.session_id, seat_no: seat } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_MOVE", { table: "english_test_registration", id: r.registration_id }, `${r.application.application_code} (SBD ${r.candidate_number}): ${r.english_test_session.session_code} → ${to.session_code}`, tx);
      await this.notifySchedule(tx, r.application.candidate_id, r.candidate_number, seat, to);
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------- kết quả
  async grade(me: StaffUser, sessionId: number, body: Record<string, unknown>) {
    const s = await this.prisma.english_test_session.findUnique({
      where: { session_id: BigInt(sessionId) },
      include: { english_test_registration: { include: { application: true } } },
    });
    if (!s) notFound("Không tìm thấy phòng thi.");
    if (s.test_at.getTime() > Date.now()) fail("NOT_YET", "Chưa đến giờ thi, chưa nhập kết quả được.", HttpStatus.CONFLICT);
    const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    if (!items.length) fail("VALIDATION", "Chưa có kết quả nào để lưu.");
    let changed = 0;
    await this.prisma.$transaction(
      async (tx) => {
        for (const it of items) {
          const reg = s.english_test_registration.find((r) => id(r.application_id) === Number(it.applicationId));
          if (!reg) fail("VALIDATION", "Có thí sinh không thuộc phòng thi này.");
          const result = String(it.result ?? "") as Result;
          if (!RESULTS.includes(result)) fail("VALIDATION", "Kết quả chỉ nhận: Đạt, Không đạt, Vắng thi hoặc Chưa có kết quả.");
          const scoreRaw = it.score === null || it.score === undefined || it.score === "" ? null : Number(String(it.score).replace(",", "."));
          if (scoreRaw !== null && (!Number.isFinite(scoreRaw) || scoreRaw < 0 || scoreRaw > 100)) fail("VALIDATION", `Điểm của SBD ${reg.candidate_number} không hợp lệ.`);
          if (result === "ABSENT" && scoreRaw !== null) fail("VALIDATION", `SBD ${reg.candidate_number} vắng thi thì không nhập điểm.`);
          const note = String(it.note ?? "").trim().slice(0, 500) || null;
          const same = reg.result === result && (dec(reg.score) ?? null) === scoreRaw && (reg.note ?? null) === note;
          if (same) continue;
          await tx.english_test_registration.update({
            where: { registration_id: reg.registration_id },
            data: {
              result,
              score: scoreRaw === null ? null : new Prisma.Decimal(scoreRaw.toFixed(2)),
              note,
              graded_by_staff_id: result === "PENDING" ? null : BigInt(me.staffAccountId),
              graded_at: result === "PENDING" ? null : new Date(),
            },
          });
          changed++;
          if (result !== "PENDING" && reg.result !== result)
            await this.audit.notifyCandidate(
              id(reg.application.candidate_id),
              `Kết quả thi đánh giá năng lực tiếng Anh: ${ENGLISH_RESULT_VI[result]}`,
              result === "PASSED"
                ? `Bạn đã ĐẠT kỳ thi đánh giá năng lực tiếng Anh (SBD ${reg.candidate_number})${scoreRaw !== null ? `, điểm ${scoreRaw}` : ""}. Hồ sơ ${reg.application.application_code} đáp ứng điều kiện ngoại ngữ.`
                : result === "FAILED"
                  ? `Bạn CHƯA ĐẠT kỳ thi đánh giá năng lực tiếng Anh (SBD ${reg.candidate_number})${scoreRaw !== null ? `, điểm ${scoreRaw}` : ""}. Hồ sơ ${reg.application.application_code} chưa đáp ứng điều kiện ngoại ngữ. Bạn có thể gửi phúc khảo trong mục Khiếu nại / Phúc khảo.${note ? `\nGhi chú: ${note}` : ""}`
                  : `Bạn VẮNG MẶT tại kỳ thi đánh giá năng lực tiếng Anh (SBD ${reg.candidate_number}). Hồ sơ ${reg.application.application_code} chưa đáp ứng điều kiện ngoại ngữ. Liên hệ Phòng Đào tạo Sau đại học nếu có lý do chính đáng.`,
              tx,
            );
        }
        if (changed)
          await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "ENGLISH_GRADE", { table: "english_test_session", id: s.session_id }, `Phòng thi ${s.session_code}: cập nhật kết quả ${changed} thí sinh`, tx);
        // Mọi thí sinh trong phòng đã có kết quả -> đánh dấu phòng thi đã xong
        const pending = await tx.english_test_registration.count({ where: { session_id: s.session_id, result: "PENDING" } });
        await tx.english_test_session.update({ where: { session_id: s.session_id }, data: { status: pending ? "SCHEDULED" : "COMPLETED" } });
      },
      { timeout: 60_000 },
    );
    return { success: true, changed };
  }
}
