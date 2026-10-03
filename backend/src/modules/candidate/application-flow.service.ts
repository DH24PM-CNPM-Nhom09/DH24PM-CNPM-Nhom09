import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { AuditService } from "../../common/audit.service";
import type { CandidateUser } from "../../common/auth";
import { env, SystemConfigService } from "../../common/config.service";
import { conflict, fail, notFound } from "../../common/errors";
import { dec, id, iso, isoReq, num, parseReviewStatus, str, transferNote } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";
import { ApplicationsService } from "../admin/applications.service";

import { DOC_LABEL, LANGUAGE_LABEL, LANGUAGE_OPTIONS, OPTIONAL_DOCS, requiredDocs, type Degree, type LanguageOption } from "../../common/documents";

type FeeItem = { code: string; label: string; amount: number };

/** Hồ sơ còn đang xử lý: mỗi thí sinh chỉ có 1 hồ sơ như vậy tại một thời điểm */
const IN_PROGRESS = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT"];

const fullInclude = {
  admission_batch_major: { include: { admission_batch: true, admission_major: true } },
  application_education: true,
  application_document: { orderBy: { document_id: "asc" } },
  application_payment: { orderBy: { payment_id: "desc" } },
  supplement_request: { orderBy: { request_id: "desc" } },
  application_status_history: { orderBy: { history_id: "asc" } },
  research_proposal: { include: { lecturer: true, supervisor_request: { orderBy: { request_id: "desc" }, include: { lecturer: true } } } },
  english_test_registration: { include: { english_test_session: true } },
} satisfies Prisma.applicationInclude;
type FullApp = Prisma.applicationGetPayload<{ include: typeof fullInclude }>;

/**
 * UC-DK-01..05 — Thí sinh tạo, hoàn thiện và nộp hồ sơ xét tuyển.
 * Hồ sơ đi qua: DRAFT (nháp, chỉ thí sinh thấy) -> SUBMITTED (đã nộp, vào hàng chờ cán bộ).
 * Khi nộp: phát sinh khoản lệ phí chờ thanh toán; cán bộ xác nhận đã thu thì mới được "Đạt".
 */
@Injectable()
export class ApplicationFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly apps: ApplicationsService,
  ) {}

  private requireProfile(me: CandidateUser): number {
    if (!me.candidateId) fail("PROFILE_REQUIRED", "Vui lòng hoàn thiện Hồ sơ cá nhân (họ tên, ngày sinh, CCCD…) trước khi tạo hồ sơ xét tuyển.", HttpStatus.CONFLICT);
    return me.candidateId;
  }

  /** Các mục hồ sơ cá nhân còn thiếu (bắt buộc đủ trước khi nộp) */
  private async missingProfile(candidateId: number) {
    const c = await this.prisma.candidate.findUniqueOrThrow({ where: { candidate_id: BigInt(candidateId) }, include: { candidate_account: true } });
    const miss: string[] = [];
    if (!c.full_name?.trim()) miss.push("họ tên");
    if (!c.dob) miss.push("ngày sinh");
    if (!c.gender) miss.push("giới tính");
    if (!c.id_number) miss.push("số CCCD");
    if (!c.address?.trim()) miss.push("địa chỉ liên hệ");
    if (!c.candidate_account.phone_number) miss.push("số điện thoại");
    return miss;
  }

  /**
   * Các khoản thu khi nộp hồ sơ (mục 6.4 thông báo tuyển sinh): đăng ký dự tuyển + xét tuyển,
   * cộng lệ phí thi đánh giá năng lực tiếng Anh nếu thí sinh đăng ký dự thi.
   */
  private async feeItems(degree: Degree, languageOption: string | null): Promise<FeeItem[]> {
    const items: FeeItem[] = [
      { code: "REGISTRATION", label: "Lệ phí đăng ký dự tuyển", amount: await this.config.int("FEE_REGISTRATION", 100_000) },
      {
        code: "REVIEW",
        label: `Lệ phí xét tuyển ${degree === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ"}`,
        amount: await this.config.int(degree === "TIEN_SI" ? "APPLICATION_FEE_TIEN_SI" : "APPLICATION_FEE_THAC_SI", degree === "TIEN_SI" ? 1_000_000 : 360_000),
      },
    ];
    if (languageOption === "TEST") items.push({ code: "ENGLISH_TEST", label: "Lệ phí đăng ký thi đánh giá năng lực tiếng Anh", amount: await this.config.int("FEE_ENGLISH_TEST", 120_000) });
    return items;
  }

  /** Các khoản có thể phát sinh sau (chỉ để thí sinh biết trước) */
  private async otherFees() {
    return {
      supplementCredit: await this.config.int("FEE_SUPPLEMENT_CREDIT", 490_000),
      appeal: await this.config.int("FEE_APPEAL", 360_000),
      englishTest: await this.config.int("FEE_ENGLISH_TEST", 120_000),
    };
  }

  private parseFeeDetail(json: string | null): FeeItem[] | null {
    if (!json) return null;
    try {
      const v = JSON.parse(json) as FeeItem[];
      return Array.isArray(v) ? v.filter((x) => x && typeof x.amount === "number") : null;
    } catch {
      return null;
    }
  }

  private async load(candidateId: number, where: Prisma.applicationWhereInput = {}) {
    return this.prisma.application.findFirst({
      where: { candidate_id: BigInt(candidateId), is_cancelled: false, deleted_at: null, ...where },
      orderBy: { application_id: "desc" },
      include: fullInclude,
    });
  }

  private async loadDraft(candidateId: number) {
    const a = await this.load(candidateId, { review_status: "DRAFT" });
    if (!a) notFound("Không có hồ sơ nháp nào. Hãy bắt đầu tạo hồ sơ mới.");
    return a;
  }

  /** Đợt còn nhận hồ sơ: đang mở, trong thời gian đăng ký, ngành đã được duyệt */
  private assertOpen(a: { admission_batch_major: { status: string; admission_batch: { status: string; registration_start_at: Date; registration_end_at: Date; deleted_at: Date | null } } }) {
    const b = a.admission_batch_major.admission_batch;
    const now = new Date();
    if (b.status !== "OPEN" || b.deleted_at) fail("BATCH_CLOSED", "Đợt tuyển sinh này không còn nhận hồ sơ.", HttpStatus.CONFLICT);
    if (now < b.registration_start_at) fail("BATCH_NOT_STARTED", "Đợt tuyển sinh chưa đến thời gian nhận hồ sơ.", HttpStatus.CONFLICT);
    if (now > b.registration_end_at) fail("BATCH_CLOSED", "Đã hết hạn nộp hồ sơ của đợt này.", HttpStatus.CONFLICT);
    if (!["APPROVED", "OPEN"].includes(a.admission_batch_major.status)) fail("MAJOR_CLOSED", "Ngành này hiện không nhận hồ sơ.", HttpStatus.CONFLICT);
  }

  private async toFull(a: FullApp) {
    const bm = a.admission_batch_major;
    const b = bm.admission_batch;
    const degree = b.degree_level as Degree;
    const edu = a.application_education;
    const pay = a.application_payment.find((p) => p.gateway_status === "SUCCESS") ?? a.application_payment[0] ?? null;
    const sup = a.supplement_request.find((r) => r.status === "PENDING") ?? null;
    const prop = a.research_proposal;
    const supReq = prop?.supervisor_request[0] ?? null;
    // Đã nộp: lấy đúng các khoản đã chốt lúc nộp; còn nháp: tính theo cấu hình hiện tại
    const feeItems = (pay && this.parseFeeDetail(pay.fee_detail)) ?? (await this.feeItems(degree, a.language_option));
    const bank = {
      bankBin: await this.config.text("PAYMENT_BANK_BIN"),
      bankName: await this.config.text("PAYMENT_BANK_NAME"),
      accountNo: await this.config.text("PAYMENT_ACCOUNT_NO"),
      accountName: await this.config.text("PAYMENT_ACCOUNT_NAME"),
    };
    const docs = a.application_document.map((d) => ({
      documentId: id(d.document_id),
      documentType: d.document_type,
      fileName: d.file_name,
      fileSizeKb: d.file_size_kb,
      verifyStatus: d.verify_status,
      verifyNote: d.verify_note,
      uploadedAt: isoReq(d.uploaded_at),
    }));
    const have = new Set(docs.map((d) => d.documentType));
    return {
      applicationId: id(a.application_id),
      applicationCode: a.application_code,
      reviewStatus: a.review_status,
      admissionStatus: a.admission_status,
      createdAt: isoReq(a.created_at),
      submittedAt: iso(a.submitted_at),
      degreeLevel: degree,
      batch: {
        batchId: id(b.batch_id),
        batchCode: b.batch_code,
        batchName: b.batch_name,
        status: b.status,
        registrationEndAt: isoReq(b.registration_end_at),
        examStartAt: iso(b.exam_start_at),
      },
      major: { batchMajorId: id(bm.batch_major_id), majorCode: bm.admission_major.major_code, majorName: bm.admission_major.major_name, facultyName: bm.admission_major.faculty_name },
      education: edu
        ? {
            degreeLevel: edu.degree_level,
            institutionName: edu.institution_name,
            majorName: edu.major_name,
            graduationYear: edu.graduation_year,
            gpa: dec(edu.gpa),
            gpaScale: dec(edu.gpa_scale),
          }
        : null,
      proposal: prop
        ? {
            researchTopic: prop.research_topic,
            researchField: prop.research_field,
            preferredLecturerId: num(prop.preferred_lecturer_id),
            lecturerName: prop.lecturer?.full_name ?? null,
            supervisorStatus: supReq?.status ?? null,
          }
        : null,
      documents: docs,
      requiredDocuments: requiredDocs(degree, a.language_option),
      optionalDocuments: OPTIONAL_DOCS.filter((t) => !requiredDocs(degree, a.language_option).includes(t)),
      missingDocuments: requiredDocs(degree, a.language_option).filter((t) => !have.has(t)),
      language: { option: a.language_option, note: a.language_note, requiredLevel: degree === "TIEN_SI" ? "bậc 4/6 (B2)" : "bậc 3/6 (B1)" },
      // Thi đánh giá năng lực tiếng Anh (chỉ khi thí sinh chọn đăng ký dự thi)
      englishTest:
        a.language_option === "TEST" && a.review_status !== "DRAFT"
          ? a.english_test_registration
            ? {
                candidateNumber: a.english_test_registration.candidate_number,
                seatNo: a.english_test_registration.seat_no,
                sessionCode: a.english_test_registration.english_test_session.session_code,
                testAt: isoReq(a.english_test_registration.english_test_session.test_at),
                room: a.english_test_registration.english_test_session.room,
                location: a.english_test_registration.english_test_session.location,
                note: a.english_test_registration.english_test_session.note,
                result: a.english_test_registration.result,
                score: dec(a.english_test_registration.score),
              }
            : { candidateNumber: null, seatNo: null, sessionCode: null, testAt: null, room: null, location: null, note: null, result: null, score: null }
          : null,
      payment: pay
        ? {
            amount: dec(pay.amount),
            status: pay.gateway_status,
            method: pay.payment_method,
            receiptNo: pay.receipt_no,
            paidAt: iso(pay.paid_at),
            transferContent: transferNote(a.application_code),
            bank,
          }
        : null,
      supplement: sup ? { content: sup.content, deadline: isoReq(sup.deadline) } : null,
      history: a.application_status_history
        .map((h) => ({ status: parseReviewStatus(h.new_status), at: isoReq(h.changed_at), by: h.changed_by_type, reason: h.reason }))
        .filter((h, i, arr) => h.status && (i === 0 || h.status !== arr[i - 1].status)),
      canEdit: a.review_status === "DRAFT" && b.status === "OPEN" && new Date() <= b.registration_end_at,
      feeItems,
      fee: feeItems.reduce((t, x) => t + x.amount, 0),
      otherFees: await this.otherFees(),
    };
  }

  // ------------------------------------------------------------------ đọc
  async full(me: CandidateUser) {
    if (!me.candidateId) return null;
    const a = await this.load(me.candidateId);
    return a ? this.toFull(a) : null;
  }

  async lecturers() {
    const rows = await this.prisma.lecturer.findMany({ where: { status: "ACTIVE", deleted_at: null }, orderBy: { full_name: "asc" } });
    return rows.map((l) => ({ lecturerId: id(l.lecturer_id), fullName: l.full_name, facultyName: l.faculty_name }));
  }

  /** Kiểm tra trước khi nộp — để giao diện hiện danh sách việc còn thiếu */
  async checklist(me: CandidateUser) {
    const candidateId = this.requireProfile(me);
    return { missingProfile: await this.missingProfile(candidateId) };
  }

  // ------------------------------------------------------------------ bước 1+2: tạo / cập nhật nháp
  async saveDraft(me: CandidateUser, body: Record<string, unknown>) {
    const candidateId = this.requireProfile(me);
    const batchMajorId = Number(body.batchMajorId);
    if (!Number.isInteger(batchMajorId) || batchMajorId <= 0) fail("VALIDATION", "Chọn đợt tuyển sinh và ngành đăng ký.");
    const bm = await this.prisma.admission_batch_major.findUnique({
      where: { batch_major_id: BigInt(batchMajorId) },
      include: { admission_batch: true, admission_major: true },
    });
    if (!bm) fail("VALIDATION", "Ngành đăng ký không tồn tại.");
    this.assertOpen({ admission_batch_major: bm });
    const degree = bm.admission_batch.degree_level as Degree;

    // Quá trình đào tạo
    const e = (body.education ?? {}) as Record<string, unknown>;
    const eduDegree = str(e.degreeLevel);
    const institution = str(e.institutionName).trim();
    const majorName = str(e.majorName).trim();
    const gradYear = Number(e.graduationYear);
    const gpaScale = Number(e.gpaScale ?? 4);
    const gpa = e.gpa === null || e.gpa === undefined || e.gpa === "" ? null : Number(e.gpa);
    if (!["DAI_HOC", "THAC_SI"].includes(eduDegree)) fail("VALIDATION", "Chọn trình độ đã tốt nghiệp.");
    if (degree === "THAC_SI" && eduDegree !== "DAI_HOC") fail("VALIDATION", "Dự tuyển thạc sĩ cần khai bằng tốt nghiệp đại học.");
    if (institution.length < 3) fail("VALIDATION", "Nhập tên cơ sở đào tạo.");
    if (majorName.length < 2) fail("VALIDATION", "Nhập ngành đã tốt nghiệp.");
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(gradYear) || gradYear < 1960 || gradYear > thisYear) fail("VALIDATION", `Năm tốt nghiệp phải từ 1960 đến ${thisYear}.`);
    if (![4, 10].includes(gpaScale)) fail("VALIDATION", "Thang điểm chỉ nhận 4 hoặc 10.");
    if (gpa !== null && (!Number.isFinite(gpa) || gpa < 0 || gpa > gpaScale)) fail("VALIDATION", `Điểm trung bình phải từ 0 đến ${gpaScale}.`);
    const eduData = {
      degree_level: eduDegree,
      institution_name: institution.slice(0, 255),
      major_name: majorName.slice(0, 255),
      graduation_year: gradYear,
      gpa: gpa === null ? null : new Prisma.Decimal(gpa.toFixed(2)),
      gpa_scale: new Prisma.Decimal(gpaScale.toFixed(2)),
    };

    const draft = await this.load(candidateId, { review_status: "DRAFT" });
    if (!draft) {
      const busy = await this.prisma.application.findFirst({
        where: { candidate_id: BigInt(candidateId), is_cancelled: false, deleted_at: null, review_status: { in: IN_PROGRESS } },
      });
      if (busy) conflict("APPLICATION_IN_PROGRESS", `Bạn đang có hồ sơ ${busy.application_code} chưa có kết quả thẩm định. Mỗi thí sinh xử lý một hồ sơ tại một thời điểm.`);
    }
    if (await this.prisma.application.count({
      where: { candidate_id: BigInt(candidateId), batch_major_id: bm.batch_major_id, is_cancelled: false, deleted_at: null, ...(draft ? { application_id: { not: draft.application_id } } : {}) },
    }))
      conflict("DUPLICATE_APPLICATION", "Bạn đã có hồ sơ cho ngành này trong đợt này.");

    const prefix = `${bm.admission_batch.batch_code}-${bm.admission_major.major_code}-`;
    const nextCode = async () => {
      const last = await this.prisma.application.findFirst({ where: { application_code: { startsWith: prefix } }, orderBy: { application_code: "desc" } });
      const seq = last ? Number(last.application_code.slice(prefix.length)) + 1 : 1;
      return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(5, "0")}`.slice(0, 30);
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const appId = await this.prisma.$transaction(async (tx) => {
          if (draft) {
            const changedMajor = draft.batch_major_id !== bm.batch_major_id;
            if (changedMajor && draft.application_document.length && draft.admission_batch_major.admission_batch.degree_level !== degree)
              fail("DEGREE_CHANGED", "Đổi sang bậc khác (thạc sĩ ↔ tiến sĩ) thì yêu cầu minh chứng khác. Hãy hủy bản nháp này và tạo hồ sơ mới.");
            await tx.application.update({
              where: { application_id: draft.application_id },
              data: { batch_major_id: bm.batch_major_id, ...(changedMajor ? { application_code: await nextCode() } : {}) },
            });
            await tx.application_education.upsert({ where: { application_id: draft.application_id }, create: { application_id: draft.application_id, ...eduData }, update: eduData });
            return draft.application_id;
          }
          const created = await tx.application.create({
            data: { application_code: await nextCode(), candidate_id: BigInt(candidateId), batch_major_id: bm.batch_major_id, review_status: "DRAFT" },
          });
          await tx.application_education.create({ data: { application_id: created.application_id, ...eduData } });
          await this.audit.record({ type: "CANDIDATE", id: candidateId }, "APPLICATION_DRAFT_CREATE", { table: "application", id: created.application_id }, `Tạo hồ sơ nháp ${created.application_code}`, tx);
          return created.application_id;
        });
        const a = await this.prisma.application.findUniqueOrThrow({ where: { application_id: appId }, include: fullInclude });
        return this.toFull(a);
      } catch (e) {
        // Hai thí sinh cùng lấy 1 số thứ tự mã hồ sơ: thử lại với số kế tiếp
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("application_code")) continue;
        throw e;
      }
    }
    fail("CODE_BUSY", "Hệ thống đang bận, vui lòng thử lại.");
  }

  // ------------------------------------------------------------------ bước 3: minh chứng
  /** Xóa minh chứng khi hồ sơ còn nháp (sau khi nộp thì không xóa được, chỉ nộp lại khi có yêu cầu bổ sung) */
  async deleteDocument(me: CandidateUser, documentId: number) {
    const candidateId = this.requireProfile(me);
    const d = await this.prisma.application_document.findFirst({
      where: { document_id: BigInt(documentId), application: { candidate_id: BigInt(candidateId), deleted_at: null } },
      include: { application: true },
    });
    if (!d) notFound("Không tìm thấy minh chứng.");
    if (d.application.review_status !== "DRAFT") fail("INVALID_STATE", "Hồ sơ đã nộp, không xóa được minh chứng.", HttpStatus.CONFLICT);
    await this.prisma.$transaction(async (tx) => {
      // Đề cương đang gắn với thông tin nghiên cứu (bậc tiến sĩ): bỏ liên kết cùng lúc
      await tx.research_proposal.deleteMany({ where: { document_id: d.document_id, application: { review_status: "DRAFT" } } });
      await tx.application_document.delete({ where: { document_id: d.document_id } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "DOCUMENT_DELETE", { table: "application_document", id: d.document_id }, `${d.application.application_code}: xóa ${d.file_name} (hồ sơ nháp)`, tx);
    });
    const root = path.resolve(env.uploadDir());
    const abs = path.resolve(root, d.file_path);
    if (abs.startsWith(root + path.sep)) fs.rm(abs, { force: true }, () => undefined);
    return { success: true };
  }

  // ------------------------------------------------------------------ bậc tiến sĩ: thông tin nghiên cứu
  async saveProposal(me: CandidateUser, body: Record<string, unknown>) {
    const candidateId = this.requireProfile(me);
    const a = await this.loadDraft(candidateId);
    if (a.admission_batch_major.admission_batch.degree_level !== "TIEN_SI") fail("VALIDATION", "Chỉ hồ sơ tiến sĩ mới khai thông tin nghiên cứu.");
    const topic = str(body.researchTopic).trim();
    const field = str(body.researchField).trim() || null;
    const lecturerId = body.preferredLecturerId ? Number(body.preferredLecturerId) : null;
    if (topic.length < 10 || topic.length > 500) fail("VALIDATION", "Tên đề tài nghiên cứu cần từ 10 đến 500 ký tự.");
    if (lecturerId !== null && !(await this.prisma.lecturer.count({ where: { lecturer_id: BigInt(lecturerId), status: "ACTIVE", deleted_at: null } })))
      fail("VALIDATION", "Giảng viên hướng dẫn không hợp lệ.");
    const doc = a.application_document.find((d) => d.document_type === "DE_CUONG_NCS");
    if (!doc) fail("PROPOSAL_DOC_REQUIRED", "Hãy tải lên tệp Đề cương nghiên cứu trước.");
    const data = { document_id: doc.document_id, research_topic: topic, research_field: field?.slice(0, 255) ?? null, preferred_lecturer_id: lecturerId === null ? null : BigInt(lecturerId) };
    await this.prisma.research_proposal.upsert({ where: { application_id: a.application_id }, create: { application_id: a.application_id, ...data }, update: data });
    return this.toFull((await this.loadDraft(candidateId))!);
  }

  // ------------------------------------------------------------------ ngoại ngữ (mục 7 thông báo)
  async saveLanguage(me: CandidateUser, body: Record<string, unknown>) {
    const candidateId = this.requireProfile(me);
    const a = await this.loadDraft(candidateId);
    const option = str(body.option) as LanguageOption;
    if (!LANGUAGE_OPTIONS.includes(option)) fail("VALIDATION", "Chọn một trong ba trường hợp ngoại ngữ.");
    const note = str(body.note).trim().replace(/\s+/g, " ").slice(0, 500) || null;
    if (option === "EXEMPT" && (note ?? "").length < 5) fail("VALIDATION", "Ghi rõ lý do được miễn (ví dụ: có bằng đại học ngành ngôn ngữ Anh).");
    await this.prisma.application.update({ where: { application_id: a.application_id }, data: { language_option: option, language_note: option === "TEST" ? null : note } });
    await this.audit.record({ type: "CANDIDATE", id: candidateId }, "APPLICATION_LANGUAGE", { table: "application", id: a.application_id }, `${a.application_code}: ${LANGUAGE_LABEL[option]}${note && option !== "TEST" ? ` (${note})` : ""}`);
    return this.toFull((await this.loadDraft(candidateId))!);
  }

  // ------------------------------------------------------------------ bước 4: nộp
  async submit(me: CandidateUser, body: Record<string, unknown>) {
    const candidateId = this.requireProfile(me);
    if (body.agree !== true) fail("VALIDATION", "Bạn cần xác nhận cam kết thông tin khai là đúng sự thật.");
    const a = await this.loadDraft(candidateId);
    this.assertOpen(a);
    const degree = a.admission_batch_major.admission_batch.degree_level as Degree;

    const problems: string[] = [];
    const missProfile = await this.missingProfile(candidateId);
    if (missProfile.length) problems.push(`Hồ sơ cá nhân còn thiếu: ${missProfile.join(", ")}`);
    if (!a.application_education) problems.push("Chưa khai quá trình đào tạo");
    if (!a.language_option) problems.push("Chưa khai thông tin ngoại ngữ (có chứng chỉ / được miễn / đăng ký dự thi)");
    else if (a.language_option === "EXEMPT" && (a.language_note ?? "").trim().length < 5) problems.push("Chưa ghi rõ lý do được miễn ngoại ngữ");
    const have = new Set(a.application_document.map((d) => d.document_type));
    const missDocs = requiredDocs(degree, a.language_option).filter((t) => !have.has(t));
    if (missDocs.length) problems.push(`Còn thiếu minh chứng: ${missDocs.map((t) => DOC_LABEL[t]).join(", ")}`);
    if (degree === "TIEN_SI" && !a.research_proposal) problems.push("Chưa khai thông tin đề tài nghiên cứu");
    if (problems.length) fail("APPLICATION_INCOMPLETE", `Chưa nộp được hồ sơ. ${problems.join(". ")}.`);

    const items = await this.feeItems(degree, a.language_option);
    const amount = items.reduce((t, x) => t + x.amount, 0);
    await this.prisma.$transaction(async (tx) => {
      await this.apps.changeStatus(tx, id(a.application_id), "DRAFT", "SUBMITTED", { type: "CANDIDATE" }, "Thí sinh nộp hồ sơ", { submitted_at: new Date() });
      if (!a.application_payment.length)
        await tx.application_payment.create({
          data: { application_id: a.application_id, amount: new Prisma.Decimal(amount), payment_method: "BANK_TRANSFER", gateway_status: "PENDING", fee_detail: JSON.stringify(items) },
        });
      // Bậc tiến sĩ: gửi yêu cầu hướng dẫn tới giảng viên đã chọn
      if (a.research_proposal?.preferred_lecturer_id && !a.research_proposal.supervisor_request.length)
        await tx.supervisor_request.create({ data: { proposal_id: a.research_proposal.proposal_id, lecturer_id: a.research_proposal.preferred_lecturer_id } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "APPLICATION_SUBMIT", { table: "application", id: a.application_id }, `Nộp hồ sơ ${a.application_code}`, tx);
      await this.audit.notifyCandidate(
        candidateId,
        `Đã nhận hồ sơ ${a.application_code}`,
        `Hồ sơ ${a.application_code} (${a.admission_batch_major.admission_major.major_name}, ${a.admission_batch_major.admission_batch.batch_name}) đã được nộp thành công.\n` +
          `Vui lòng nộp lệ phí ${amount.toLocaleString("vi-VN")} đồng (${items.map((x) => `${x.label.toLowerCase()} ${x.amount.toLocaleString("vi-VN")}đ`).join(" + ")}) theo hướng dẫn trên cổng thông tin, ghi nội dung chuyển khoản: ${transferNote(a.application_code)} (có mã QR trên cổng thông tin, quét bằng app ngân hàng là điền sẵn).\n` +
          `Cán bộ tuyển sinh sẽ tiếp nhận và thẩm định hồ sơ; kết quả được thông báo qua cổng và email.`,
        tx,
      );
    });
    return this.toFull((await this.load(candidateId, { application_id: a.application_id }))!);
  }

  /** Hủy bản nháp (chưa nộp). Đánh dấu is_cancelled, không xóa dữ liệu. */
  async cancelDraft(me: CandidateUser) {
    const candidateId = this.requireProfile(me);
    const a = await this.loadDraft(candidateId);
    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { application_id: a.application_id }, data: { is_cancelled: true } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "APPLICATION_DRAFT_CANCEL", { table: "application", id: a.application_id }, `Hủy hồ sơ nháp ${a.application_code}`, tx);
    });
    return { success: true };
  }
}
