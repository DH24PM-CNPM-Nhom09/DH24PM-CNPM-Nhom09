import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { AuditService } from "../../common/audit.service";
import { can } from "../../common/permissions";
import type { StaffUser } from "../../common/auth";
import { env } from "../../common/config.service";
import { conflict, fail, notFound } from "../../common/errors";
import { blockReason, REVIEW_VI, STAFF_ACTIONS, TRANSITIONS, type ReviewAction, type ReviewFacts, type ReviewStatus } from "../../common/review-rules";
import { dec, id, iso, isoReq, num, parseReviewStatus, toInt, transferNote, ymd } from "../../common/util";
import { PrismaService, type Tx } from "../../prisma/prisma.service";
import { toAuditDto, toBatchDto, toBatchMajorDto, toHistoryDto, toMajorDto } from "./mappers";

const REVIEWABLE: ReviewStatus[] = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT", "APPROVED", "REJECTED"];

/** Điều kiện "hồ sơ hợp lệ để kết luận đạt": đã thanh toán và mọi minh chứng VALID */
const READY_WHERE: Prisma.applicationWhereInput = {
  review_status: "UNDER_REVIEW",
  application_document: { some: {}, every: { verify_status: "VALID" } },
  application_payment: { some: { gateway_status: "SUCCESS" } },
  // Đăng ký thi tiếng Anh thì phải có kết quả Đạt mới "chờ kết luận"
  OR: [{ language_option: null }, { language_option: { not: "TEST" } }, { english_test_registration: { is: { result: "PASSED" } } }],
};
const overdueWhere = (now: Date): Prisma.applicationWhereInput => ({
  review_status: "NEEDS_SUPPLEMENT",
  supplement_request: { some: { status: "PENDING", deadline: { lt: now } } },
});

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ dùng chung
  private base(): Prisma.applicationWhereInput {
    // Hồ sơ nháp (thí sinh chưa bấm nộp) không hiện với cán bộ
    return { deleted_at: null, is_cancelled: false, review_status: { in: REVIEWABLE } };
  }

  private async staffNames(): Promise<Record<number, string>> {
    const rows = await this.prisma.staff_account.findMany({ select: { staff_account_id: true, full_name: true } });
    return Object.fromEntries(rows.map((r) => [id(r.staff_account_id), r.full_name]));
  }

  private async facts(db: Tx, applicationId: number): Promise<ReviewFacts & { candidateId: number; code: string }> {
    const a = await db.application.findFirst({
      where: { application_id: BigInt(applicationId), deleted_at: null },
      include: {
        application_document: { select: { verify_status: true } },
        application_payment: { select: { gateway_status: true } },
        supplement_request: { where: { status: "PENDING" }, orderBy: { request_id: "desc" }, take: 1 },
        english_test_registration: { select: { result: true } },
      },
    });
    if (!a) notFound("Không tìm thấy hồ sơ.");
    return {
      englishTestRequired: a.language_option === "TEST",
      englishTestResult: a.english_test_registration?.result ?? null,
      candidateId: id(a.candidate_id),
      code: a.application_code,
      reviewStatus: a.review_status,
      isCancelled: a.is_cancelled,
      paid: a.application_payment.some((p) => p.gateway_status === "SUCCESS"),
      docsTotal: a.application_document.length,
      docsValid: a.application_document.filter((d) => d.verify_status === "VALID").length,
      pendingSupplementDeadline: a.supplement_request[0]?.deadline ?? null,
    };
  }

  /**
   * Đổi review_status an toàn khi nhiều cán bộ thao tác cùng lúc (chỉ cập nhật
   * nếu trạng thái vẫn đúng như lúc kiểm tra), rồi điền "ai làm, vì sao" vào
   * dòng lịch sử mà trigger #9 vừa tự tạo — xem ghi chú cuối migration v4.
   */
  async changeStatus(
    tx: Tx,
    applicationId: number,
    from: ReviewStatus,
    to: ReviewStatus,
    actor: { type: "STAFF" | "CANDIDATE" | "SYSTEM"; staffId?: number | null },
    reason: string | null,
    extra: Prisma.applicationUncheckedUpdateManyInput = {},
  ) {
    const res = await tx.application.updateMany({
      where: { application_id: BigInt(applicationId), review_status: from },
      data: { review_status: to, ...extra },
    });
    if (res.count === 0) conflict("STALE_STATUS", "Hồ sơ vừa được người khác cập nhật. Tải lại trang để xem trạng thái mới nhất.");
    const row = await tx.application_status_history.findFirst({
      where: { application_id: BigInt(applicationId) },
      orderBy: { history_id: "desc" },
    });
    const data = {
      changed_by_type: actor.type,
      changed_by_staff_id: actor.staffId ? BigInt(actor.staffId) : null,
      reason: reason ? reason.slice(0, 500) : null,
    };
    if (row && parseReviewStatus(row.new_status) === to && row.changed_by_type === "SYSTEM") {
      await tx.application_status_history.update({ where: { history_id: row.history_id }, data });
    } else {
      // Phòng trường hợp CSDL chưa có trigger #9 (ví dụ chạy schema rút gọn)
      await tx.application_status_history.create({
        data: { application_id: BigInt(applicationId), old_status: from, new_status: to, ...data },
      });
    }
  }

  // ------------------------------------------------------------------ tra cứu
  async lookups() {
    const [batches, majors, bms, staff] = await Promise.all([
      this.prisma.admission_batch.findMany({ where: { deleted_at: null }, orderBy: { created_at: "desc" } }),
      this.prisma.admission_major.findMany({ where: { deleted_at: null }, orderBy: { major_name: "asc" } }),
      this.prisma.admission_batch_major.findMany({ include: { exam_subject: true, admission_condition: true } }),
      this.prisma.staff_account.findMany({ where: { deleted_at: null }, select: { staff_account_id: true, full_name: true, staff_code: true } }),
    ]);
    return {
      batches: batches.map(toBatchDto),
      majors: majors.map(toMajorDto),
      batchMajors: bms.map(toBatchMajorDto),
      staff: staff.map((s) => ({ staffAccountId: id(s.staff_account_id), fullName: s.full_name, staffCode: s.staff_code })),
    };
  }

  // ------------------------------------------------------------------ bảng điều khiển
  async dashboard(me: StaffUser) {
    const now = new Date();
    const openBatches = await this.prisma.admission_batch.findMany({
      where: { status: "OPEN", deleted_at: null },
      include: { admission_batch_major: { include: { admission_major: true } } },
      orderBy: { created_at: "desc" },
    });
    const bmIds = openBatches.flatMap((b) => b.admission_batch_major.map((bm) => bm.batch_major_id));
    const scope: Prisma.applicationWhereInput = { ...this.base(), batch_major_id: { in: bmIds } };

    const [grouped, oldest, mine, ready, overdue, pendingAppeals, configuring, locked, perBm, recent] = await Promise.all([
      this.prisma.application.groupBy({ by: ["review_status"], where: scope, _count: { _all: true } }),
      this.prisma.application.findFirst({ where: { ...scope, review_status: "SUBMITTED" }, orderBy: { submitted_at: "asc" }, select: { submitted_at: true } }),
      this.prisma.application.count({ where: { ...scope, review_status: "UNDER_REVIEW", assigned_staff_id: BigInt(me.staffAccountId) } }),
      this.prisma.application.count({ where: { AND: [scope, READY_WHERE] } }),
      this.prisma.application.count({ where: { AND: [scope, overdueWhere(now)] } }),
      this.prisma.score_appeal.count({ where: { status: "PENDING" } }),
      this.prisma.admission_batch_major.count({ where: { status: "CONFIGURING", admission_batch: { deleted_at: null } } }),
      this.prisma.staff_account.count({ where: { status: "LOCKED", deleted_at: null } }),
      this.prisma.application.groupBy({ by: ["batch_major_id", "review_status"], where: scope, _count: { _all: true } }),
      can(me.roles, "audit:view") ? this.prisma.audit_log.findMany({ orderBy: { created_at: "desc" }, take: 6 }) : Promise.resolve([]),
    ]);

    const statusCounts: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, NEEDS_SUPPLEMENT: 0, APPROVED: 0, REJECTED: 0 };
    grouped.forEach((g) => (statusCounts[g.review_status] = g._count._all));

    return {
      statusCounts,
      waitingOldestDays: oldest?.submitted_at ? Math.floor((now.getTime() - oldest.submitted_at.getTime()) / 86_400_000) : null,
      myUnderReview: mine,
      readyToConclude: ready,
      overdueSupplements: overdue,
      pendingAppeals,
      configuringMajors: configuring,
      lockedAccounts: locked,
      progress: openBatches.map((b) => ({
        batchCode: b.batch_code,
        batchName: b.batch_name,
        rows: b.admission_batch_major.map((bm) => {
          const rows = perBm.filter((p) => p.batch_major_id === bm.batch_major_id);
          return {
            batchMajorId: id(bm.batch_major_id),
            majorName: bm.admission_major.major_name,
            quota: bm.quota,
            submitted: rows.reduce((s, r) => s + r._count._all, 0),
            approved: rows.filter((r) => r.review_status === "APPROVED").reduce((s, r) => s + r._count._all, 0),
          };
        }),
      })),
      recent: recent.map(toAuditDto),
    };
  }

  // ------------------------------------------------------------------ danh sách
  async list(q: Record<string, string | undefined>) {
    const now = new Date();
    const page = toInt(q.page, 1);
    const pageSize = Math.min(100, toInt(q.pageSize, 15));
    const and: Prisma.applicationWhereInput[] = [this.base()];
    if (q.batchId) and.push({ admission_batch_major: { batch_id: BigInt(toInt(q.batchId, 0)) } });
    if (q.majorId) and.push({ admission_batch_major: { major_id: BigInt(toInt(q.majorId, 0)) } });
    const text = (q.q ?? "").trim();
    if (text) {
      // Dán nội dung chuyển khoản từ sao kê (mã hồ sơ đã bỏ dấu gạch) vẫn tìm ra hồ sơ
      const byNote =
        /^[A-Za-z0-9]{6,25}$/.test(text)
          ? (await this.prisma.$queryRaw<{ application_id: bigint }[]>`SELECT application_id FROM application WHERE REPLACE(application_code, '-', '') LIKE ${`%${text}%`} LIMIT 200`).map((r) => r.application_id)
          : [];
      and.push({
        OR: [
          { application_code: { contains: text } },
          ...(byNote.length ? [{ application_id: { in: byNote } }] : []),
          { candidate: { full_name: { contains: text } } },
          { candidate: { id_number: { contains: text } } },
          { candidate: { candidate_account: { email: { contains: text } } } },
        ],
      });
    }
    const scope: Prisma.applicationWhereInput = { AND: and };

    const grouped = await this.prisma.application.groupBy({ by: ["review_status"], where: scope, _count: { _all: true } });
    const counts: Record<string, number> = { ALL: 0, DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, NEEDS_SUPPLEMENT: 0, APPROVED: 0, REJECTED: 0 };
    grouped.forEach((g) => {
      counts[g.review_status] = g._count._all;
      counts.ALL += g._count._all;
    });

    const filtered: Prisma.applicationWhereInput[] = [scope];
    if (q.status === "READY") filtered.push(READY_WHERE);
    else if (q.status === "OVERDUE") filtered.push(overdueWhere(now));
    else if (q.status && REVIEWABLE.includes(q.status as ReviewStatus)) filtered.push({ review_status: q.status });
    const where: Prisma.applicationWhereInput = { AND: filtered };

    const [total, rows] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        orderBy: [{ submitted_at: q.sort === "submitted_asc" ? "asc" : "desc" }, { application_id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          candidate: { include: { candidate_account: { select: { email: true } } } },
          admission_batch_major: { include: { admission_major: true, admission_batch: true } },
          application_document: { select: { verify_status: true } },
          application_payment: { select: { gateway_status: true } },
          supplement_request: { where: { status: "PENDING" }, select: { deadline: true } },
          staff_account: { select: { full_name: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      counts,
      items: rows.map((a) => ({
        applicationId: id(a.application_id),
        applicationCode: a.application_code,
        candidateName: a.candidate.full_name,
        candidateEmail: a.candidate.candidate_account.email ?? "",
        majorName: a.admission_batch_major.admission_major.major_name,
        degreeLevel: a.admission_batch_major.admission_major.degree_level,
        batchCode: a.admission_batch_major.admission_batch.batch_code,
        reviewStatus: a.review_status,
        submittedAt: iso(a.submitted_at),
        paid: a.application_payment.some((p) => p.gateway_status === "SUCCESS"),
        docsValid: a.application_document.filter((d) => d.verify_status === "VALID").length,
        docsTotal: a.application_document.length,
        overdue: a.review_status === "NEEDS_SUPPLEMENT" && a.supplement_request.some((s) => s.deadline < now),
        assignedStaffName: a.staff_account?.full_name ?? null,
      })),
    };
  }

  // ------------------------------------------------------------------ chi tiết
  async detail(applicationId: number) {
    const a = await this.prisma.application.findFirst({
      where: { application_id: BigInt(applicationId), deleted_at: null, review_status: { in: REVIEWABLE } },
      include: {
        candidate: { include: { candidate_account: true } },
        application_education: true,
        application_document: { orderBy: { document_id: "asc" } },
        application_payment: { orderBy: { payment_id: "desc" } },
        supplement_request: { orderBy: { request_id: "desc" } },
        application_status_history: { orderBy: { history_id: "asc" } },
        admission_batch_major: { include: { admission_batch: true, admission_major: true, exam_subject: true, admission_condition: true } },
        english_test_registration: { include: { english_test_session: true } },
      },
    });
    if (!a) notFound("Không tìm thấy hồ sơ.");
    const c = a.candidate;
    const et = a.english_test_registration;
    const edu = a.application_education;
    const pay = a.application_payment.find((p) => p.gateway_status === "SUCCESS") ?? a.application_payment[0] ?? null;
    const history = a.application_status_history
      .map(toHistoryDto)
      .filter((h) => h.newStatus !== null && h.newStatus !== h.oldStatus && h.newStatus !== "DRAFT");

    return {
      application: {
        applicationId: id(a.application_id),
        applicationCode: a.application_code,
        batchMajorId: id(a.batch_major_id),
        reviewStatus: a.review_status,
        admissionStatus: a.admission_status,
        isCancelled: a.is_cancelled,
        submittedAt: iso(a.submitted_at),
        assignedStaffId: num(a.assigned_staff_id),
        language: { option: a.language_option, note: a.language_note },
        englishTest:
          a.language_option === "TEST"
            ? et
              ? { result: et.result, score: dec(et.score), candidateNumber: et.candidate_number, sessionCode: et.english_test_session.session_code, testAt: isoReq(et.english_test_session.test_at), room: et.english_test_session.room }
              : { result: null, score: null, candidateNumber: null, sessionCode: null, testAt: null, room: null }
            : null,
        candidate: {
          candidateId: id(c.candidate_id),
          fullName: c.full_name,
          dob: ymd(c.dob),
          gender: c.gender,
          idNumber: c.id_number,
          email: c.candidate_account.email,
          phoneNumber: c.candidate_account.phone_number,
          address: c.address,
          graduatedFrom: edu?.institution_name ?? null,
          graduatedMajor: edu?.major_name ?? null,
          graduationYear: edu?.graduation_year ?? null,
          gpa: dec(edu?.gpa),
          gpaScale: dec(edu?.gpa_scale) ?? 4,
        },
        documents: a.application_document.map((d) => ({
          documentId: id(d.document_id),
          documentType: d.document_type,
          fileName: d.file_name,
          fileSizeKb: d.file_size_kb,
          fileHash: d.file_hash,
          verifyStatus: d.verify_status,
          uploadedAt: isoReq(d.uploaded_at),
          invalidReason: d.verify_status === "INVALID" ? d.verify_note : null,
        })),
        payment: pay
          ? {
              paymentId: id(pay.payment_id),
              amount: Number(pay.amount),
              paymentMethod: pay.payment_method,
              transactionCode: pay.transaction_code,
              gatewayStatus: pay.gateway_status,
              paidAt: iso(pay.paid_at),
              receiptNo: pay.receipt_no,
              feeDetail: (() => {
                try {
                  return pay.fee_detail ? (JSON.parse(pay.fee_detail) as { code: string; label: string; amount: number }[]) : null;
                } catch {
                  return null;
                }
              })(),
              transferContent: transferNote(a.application_code),
            }
          : null,
        supplements: a.supplement_request.map((s) => ({
          requestId: id(s.request_id),
          requestedByStaffId: num(s.requested_by_staff_id),
          content: s.content,
          deadline: isoReq(s.deadline),
          status: s.status,
          createdAt: isoReq(s.created_at),
          respondedAt: iso(s.responded_at),
        })),
        history,
      },
      batch: toBatchDto(a.admission_batch_major.admission_batch),
      major: toMajorDto(a.admission_batch_major.admission_major),
      batchMajor: toBatchMajorDto(a.admission_batch_major),
      staffNames: await this.staffNames(),
    };
  }

  // ------------------------------------------------------------------ lệ phí
  /**
   * Cán bộ xác nhận đã nhận lệ phí (đối chiếu sao kê ngân hàng theo nội dung
   * chuyển khoản "<mã hồ sơ> <mã thí sinh>"). Có xác nhận này hồ sơ mới được kết luận Đạt.
   */
  async confirmPayment(me: StaffUser, applicationId: number, body: { receiptNo?: unknown; transactionCode?: unknown; paidAt?: unknown }) {
    const receiptNo = String(body.receiptNo ?? "").trim().slice(0, 50) || null;
    const transactionCode = String(body.transactionCode ?? "").trim().slice(0, 100) || null;
    const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date();
    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 60_000) fail("VALIDATION", "Ngày nộp tiền không hợp lệ.");
    const a = await this.prisma.application.findFirst({
      where: { application_id: BigInt(applicationId), ...this.base() },
      include: { application_payment: { orderBy: { payment_id: "desc" } } },
    });
    if (!a) notFound("Không tìm thấy hồ sơ.");
    if (a.application_payment.some((p) => p.gateway_status === "SUCCESS")) conflict("ALREADY_PAID", "Hồ sơ này đã được xác nhận nộp lệ phí.");
    const pay = a.application_payment.find((p) => p.gateway_status === "PENDING");
    if (!pay) fail("NO_PAYMENT", "Hồ sơ chưa phát sinh khoản lệ phí cần thu.", HttpStatus.CONFLICT);
    if (transactionCode && (await this.prisma.application_payment.count({ where: { transaction_code: transactionCode } })))
      conflict("DUPLICATE_TRANSACTION", "Mã giao dịch này đã được dùng để xác nhận cho hồ sơ khác.");
    const amount = Number(pay.amount).toLocaleString("vi-VN");
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.application_payment.updateMany({
        where: { payment_id: pay.payment_id, gateway_status: "PENDING" },
        data: { gateway_status: "SUCCESS", paid_at: paidAt, receipt_no: receiptNo, transaction_code: transactionCode },
      });
      if (!r.count) conflict("STALE_STATUS", "Khoản lệ phí vừa được người khác cập nhật. Tải lại trang.");
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "PAYMENT_CONFIRM",
        { table: "application_payment", id: pay.payment_id },
        `${a.application_code}: xác nhận đã thu ${amount}đ${receiptNo ? `, biên lai ${receiptNo}` : ""}${transactionCode ? `, mã GD ${transactionCode}` : ""}`,
        tx,
      );
      await this.audit.notifyCandidate(
        id(a.candidate_id),
        `Đã nhận lệ phí hồ sơ ${a.application_code}`,
        `Phòng Đào tạo Sau đại học đã nhận lệ phí xét tuyển ${amount} đồng của hồ sơ ${a.application_code}${receiptNo ? ` (biên lai số ${receiptNo})` : ""}. Hồ sơ của bạn tiếp tục được thẩm định.`,
        tx,
      );
    });
    return { success: true };
  }

  /** Cấu hình lệ phí và tài khoản nhận chuyển khoản (bảng system_config) */
  async paymentSettings() {
    const keys = ["FEE_REGISTRATION", "APPLICATION_FEE_THAC_SI", "APPLICATION_FEE_TIEN_SI", "FEE_ENGLISH_TEST", "FEE_SUPPLEMENT_CREDIT", "FEE_APPEAL", "PAYMENT_BANK_BIN", "PAYMENT_BANK_NAME", "PAYMENT_ACCOUNT_NO", "PAYMENT_ACCOUNT_NAME"];
    const rows = await this.prisma.system_config.findMany({ where: { config_key: { in: keys } } });
    const v = (k: string) => rows.find((r) => r.config_key === k)?.config_value?.trim() ?? "";
    return {
      feeRegistration: Number(v("FEE_REGISTRATION")) || 100_000,
      feeThacSi: Number(v("APPLICATION_FEE_THAC_SI")) || 360_000,
      feeTienSi: Number(v("APPLICATION_FEE_TIEN_SI")) || 1_000_000,
      feeEnglishTest: Number(v("FEE_ENGLISH_TEST")) || 120_000,
      feeSupplementCredit: Number(v("FEE_SUPPLEMENT_CREDIT")) || 490_000,
      feeAppeal: Number(v("FEE_APPEAL")) || 360_000,
      bankBin: v("PAYMENT_BANK_BIN"),
      bankName: v("PAYMENT_BANK_NAME"),
      accountNo: v("PAYMENT_ACCOUNT_NO"),
      accountName: v("PAYMENT_ACCOUNT_NAME"),
    };
  }

  async updatePaymentSettings(me: StaffUser, body: Record<string, unknown>) {
    const fee = (x: unknown, label: string) => {
      const n = Number(x);
      if (!Number.isInteger(n) || n < 0 || n > 100_000_000) fail("VALIDATION", `${label} phải là số tiền hợp lệ (đồng).`);
      return String(n);
    };
    const text = (x: unknown, max: number) => String(x ?? "").trim().replace(/\s+/g, " ").slice(0, max);
    const accountNo = text(body.accountNo, 40).replace(/\s/g, "");
    if (accountNo && !/^[0-9A-Za-z]{4,19}$/.test(accountNo)) fail("VALIDATION", "Số tài khoản gồm 4–19 chữ số (hoặc chữ cái), không có dấu cách hay gạch ngang.");
    const bankBin = text(body.bankBin, 6);
    if (bankBin && !/^\d{6}$/.test(bankBin)) fail("VALIDATION", "Mã ngân hàng (BIN) gồm 6 chữ số.");
    const values: [string, string, string][] = [
      ["FEE_REGISTRATION", fee(body.feeRegistration, "Lệ phí đăng ký dự tuyển"), "Lệ phí đăng ký dự tuyển (đồng/hồ sơ)"],
      ["APPLICATION_FEE_THAC_SI", fee(body.feeThacSi, "Lệ phí xét tuyển thạc sĩ"), "Lệ phí xét tuyển thạc sĩ (đồng/hồ sơ)"],
      ["APPLICATION_FEE_TIEN_SI", fee(body.feeTienSi, "Lệ phí xét tuyển tiến sĩ"), "Lệ phí xét tuyển tiến sĩ (đồng/hồ sơ)"],
      ["FEE_ENGLISH_TEST", fee(body.feeEnglishTest, "Lệ phí thi tiếng Anh"), "Lệ phí đăng ký thi đánh giá năng lực tiếng Anh (đồng/thí sinh)"],
      ["FEE_SUPPLEMENT_CREDIT", fee(body.feeSupplementCredit, "Học phí bổ sung kiến thức"), "Học phí học bổ sung kiến thức (đồng/tín chỉ)"],
      ["FEE_APPEAL", fee(body.feeAppeal, "Lệ phí phúc khảo"), "Lệ phí phúc khảo hồ sơ (đồng/hồ sơ)"],
      ["PAYMENT_BANK_BIN", bankBin, "Mã BIN ngân hàng nhận lệ phí (NAPAS), dùng tạo mã VietQR"],
      ["PAYMENT_BANK_NAME", text(body.bankName, 200), "Ngân hàng nhận lệ phí"],
      ["PAYMENT_ACCOUNT_NO", accountNo, "Số tài khoản nhận lệ phí"],
      ["PAYMENT_ACCOUNT_NAME", text(body.accountName, 200).toUpperCase(), "Tên chủ tài khoản nhận lệ phí"],
    ];
    await this.prisma.$transaction(async (tx) => {
      for (const [k, val, desc] of values)
        await tx.system_config.upsert({ where: { config_key: k }, create: { config_key: k, config_value: val, description: desc }, update: { config_value: val } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "PAYMENT_SETTINGS_UPDATE", { table: "system_config", id: null }, `Cập nhật lệ phí (đăng ký ${values[0][1]}đ, xét tuyển ThS ${values[1][1]}đ, TS ${values[2][1]}đ, thi tiếng Anh ${values[3][1]}đ) và tài khoản nhận`, tx);
    });
    return this.paymentSettings();
  }

  // ------------------------------------------------------------------ minh chứng
  async verifyDocument(me: StaffUser, documentId: number, status: string, reason?: string) {
    if (!["VALID", "INVALID", "PENDING"].includes(status)) fail("VALIDATION", "Trạng thái minh chứng không hợp lệ.");
    const note = (reason ?? "").trim();
    if (status === "INVALID" && !note) fail("REASON_REQUIRED", "Nhập lý do minh chứng không hợp lệ.");
    const doc = await this.prisma.application_document.findUnique({
      where: { document_id: BigInt(documentId) },
      include: { application: { select: { application_id: true, application_code: true, review_status: true } } },
    });
    if (!doc) notFound("Không tìm thấy minh chứng.");
    if (doc.application.review_status !== "UNDER_REVIEW") fail("INVALID_STATE", "Chỉ kiểm tra minh chứng khi hồ sơ đang thẩm định.");
    await this.prisma.$transaction(async (tx) => {
      await tx.application_document.update({
        where: { document_id: doc.document_id },
        data: {
          verify_status: status,
          verify_note: status === "INVALID" ? note.slice(0, 500) : null,
          verified_by_staff_id: status === "PENDING" ? null : BigInt(me.staffAccountId),
          verified_at: status === "PENDING" ? null : new Date(),
        },
      });
      const label = status === "VALID" ? "hợp lệ" : status === "INVALID" ? "không hợp lệ" : "chưa kiểm tra";
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "DOCUMENT_VERIFY",
        { table: "application_document", id: doc.document_id },
        `${doc.application.application_code}, ${doc.file_name}: ${label}${note && status === "INVALID" ? ` (${note})` : ""}`,
        tx,
      );
    });
    return { success: true };
  }

  /** Đường dẫn tệp trên đĩa — chặn mọi đường dẫn thoát ra ngoài thư mục upload */
  async documentFile(documentId: number) {
    const doc = await this.prisma.application_document.findUnique({ where: { document_id: BigInt(documentId) } });
    if (!doc) notFound("Không tìm thấy minh chứng.");
    const root = path.resolve(env.uploadDir());
    const abs = path.resolve(root, doc.file_path);
    if (!abs.startsWith(root + path.sep) || !fs.existsSync(abs)) notFound("Tệp minh chứng không còn trên máy chủ.");
    return { abs, fileName: doc.file_name };
  }

  // ------------------------------------------------------------------ thẩm định
  async review(me: StaffUser, applicationId: number, action: string, payload: { reason?: string; supplementContent?: string; deadline?: string }) {
    if (!STAFF_ACTIONS.includes(action as ReviewAction)) fail("VALIDATION", "Thao tác thẩm định không hợp lệ.");
    const act = action as ReviewAction;
    let reason = payload.reason?.trim() || null;
    let deadline: Date | null = null;
    const content = payload.supplementContent?.trim() ?? "";

    if (act === "REJECT" && (!reason || reason.length < 10)) fail("REASON_REQUIRED", "Lý do không đạt cần ít nhất 10 ký tự để thí sinh hiểu rõ.");
    if (act === "REQUEST_SUPPLEMENT") {
      if (content.length < 10) fail("CONTENT_REQUIRED", "Nêu cụ thể giấy tờ cần bổ sung (ít nhất 10 ký tự).");
      deadline = payload.deadline ? new Date(payload.deadline) : null;
      if (!deadline || Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) fail("INVALID_DEADLINE", "Hạn bổ sung phải sau thời điểm hiện tại.");
      reason = content;
    }
    if (act === "REJECT_EXPIRED") reason = "Quá hạn bổ sung hồ sơ.";

    const { from, to } = TRANSITIONS[act];
    let notified = false;

    await this.prisma.$transaction(async (tx) => {
      const f = await this.facts(tx, applicationId);
      const blocked = blockReason(f, act);
      if (blocked) fail("INVALID_TRANSITION", blocked, HttpStatus.CONFLICT);

      await this.changeStatus(tx, applicationId, from, to, { type: "STAFF", staffId: me.staffAccountId }, reason, act === "START_REVIEW" ? { assigned_staff_id: BigInt(me.staffAccountId) } : {});

      if (act === "REQUEST_SUPPLEMENT") {
        await tx.supplement_request.create({
          data: { application_id: BigInt(applicationId), requested_by_staff_id: BigInt(me.staffAccountId), content, deadline: deadline! },
        });
      }
      if (act === "REJECT_EXPIRED") {
        await tx.supplement_request.updateMany({ where: { application_id: BigInt(applicationId), status: "PENDING" }, data: { status: "EXPIRED" } });
      }
      const result = act === "APPROVE" ? "PASS" : act === "REQUEST_SUPPLEMENT" ? "NEEDS_SUPPLEMENT" : act === "START_REVIEW" ? null : "FAIL";
      if (result) {
        await tx.application_review.create({
          data: { application_id: BigInt(applicationId), reviewer_staff_id: BigInt(me.staffAccountId), review_type: "MANUAL_REVIEW", review_result: result, note: reason },
        });
      }

      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        `APPLICATION_${act}`,
        { table: "application", id: applicationId },
        `${f.code}: ${REVIEW_VI[from]} → ${REVIEW_VI[to]}${reason ? `. ${reason}` : ""}`,
        tx,
      );

      const vn = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const message: Record<string, [string, string]> = {
        START_REVIEW: ["Hồ sơ đã được tiếp nhận", `Hồ sơ ${f.code} đã được tiếp nhận và đang thẩm định.`],
        APPROVE: ["Hồ sơ đạt thẩm định", `Hồ sơ ${f.code} đạt thẩm định, đủ điều kiện dự tuyển.`],
        REJECT: ["Hồ sơ không đạt thẩm định", `Hồ sơ ${f.code} không đạt thẩm định. Lý do: ${reason}`],
        REQUEST_SUPPLEMENT: ["Yêu cầu bổ sung hồ sơ", `Hồ sơ ${f.code} cần bổ sung: ${reason}. Hạn: ${deadline ? vn(deadline) : ""}.`],
        REJECT_EXPIRED: ["Hồ sơ không đạt", `Hồ sơ ${f.code} không đạt do quá hạn bổ sung.`],
      };
      const [title, body] = message[act];
      await this.audit.notifyCandidate(f.candidateId, title, body, tx);
      notified = true;
    });

    return { success: true, reviewStatus: to, notified };
  }

  async bulkStart(me: StaffUser, ids: unknown) {
    const list = Array.isArray(ids) ? ids.map((x) => toInt(x, 0)).filter((x) => x > 0) : [];
    if (list.length === 0) fail("VALIDATION", "Chưa chọn hồ sơ nào.");
    if (list.length > 200) fail("VALIDATION", "Mỗi lần tiếp nhận tối đa 200 hồ sơ.");
    let done = 0;
    let skipped = 0;
    for (const applicationId of list) {
      try {
        await this.review(me, applicationId, "START_REVIEW", {});
        done++;
      } catch {
        skipped++;
      }
    }
    return { done, skipped };
  }
}
