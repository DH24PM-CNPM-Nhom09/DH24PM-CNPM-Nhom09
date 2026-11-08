import { HttpStatus, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { AuditService } from "../../common/audit.service";
import { DOC_TYPES } from "../../common/documents";
import type { CandidateUser } from "../../common/auth";
import { env, SystemConfigService } from "../../common/config.service";
import { conflict, fail, notFound } from "../../common/errors";
import { id, iso, isoReq, str, ymd } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";
import { removeFile, saveFile } from "../../common/file-store";
import { phoneAvailable } from "../../common/pending-accounts";
import { ApplicationsService } from "../admin/applications.service";
import { dobError, fullNameError, isVnPhone, normalizeFullName, normalizePhone, parseYmd, tooLong } from "../../common/validate";

const ALLOWED_MIME: Record<string, string> = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png" };
const COMPLAINT_TYPES = ["PHUC_KHAO_DIEM", "KHIEU_NAI_KET_QUA", "KHIEU_NAI_HO_SO", "KHAC"];

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class CandidateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly apps: ApplicationsService,
  ) {}

  private requireProfile(me: CandidateUser): number {
    if (!me.candidateId) fail("PROFILE_REQUIRED", "Vui lòng hoàn thiện hồ sơ cá nhân trước.", HttpStatus.CONFLICT);
    return me.candidateId;
  }

  /** Hồ sơ đang hoạt động gần nhất của thí sinh (chưa rút) */
  private currentApplication(candidateId: number) {
    return this.prisma.application.findFirst({
      where: { candidate_id: BigInt(candidateId), is_cancelled: false, deleted_at: null },
      orderBy: { application_id: "desc" },
      include: { admission_batch_major: { include: { admission_batch: true, admission_major: true } } },
    });
  }

  // ------------------------------------------------------------------ hồ sơ cá nhân
  async profile(me: CandidateUser) {
    const account = await this.prisma.candidate_account.findUniqueOrThrow({ where: { account_id: BigInt(me.accountId) }, include: { candidate: true } });
    const c = account.candidate;
    return {
      candidateId: c ? id(c.candidate_id) : null,
      fullName: c?.full_name ?? "",
      dob: ymd(c?.dob) ?? "",
      gender: c?.gender ?? null,
      idNumber: c?.id_number ?? null,
      address: c?.address ?? null,
      email: account.email,
      phoneNumber: account.phone_number,
      nationality: c?.nationality ?? "Việt Nam",
      idIssueDate: ymd(c?.id_issue_date) ?? null,
      idIssuePlace: c?.id_issue_place ?? null,
      birthplace: c?.birthplace ?? null,
      ethnicity: c?.ethnicity ?? null,
      permanentAddress: c?.permanent_address ?? null,
      accountCreatedAt: isoReq(account.created_at),
      hasPassword: Boolean(account.password_hash),
    };
  }

  async updateProfile(me: CandidateUser, body: Record<string, unknown>) {
    // Cùng quy tắc với lúc đăng ký (auth.service register) — xem common/validate.ts
    const fullName = body.fullName !== undefined ? normalizeFullName(body.fullName) : undefined;
    const dobRaw = body.dob !== undefined ? parseYmd(body.dob) : undefined;
    const gender = body.gender !== undefined ? (body.gender === null ? null : str(body.gender)) : undefined;
    const idNumber = body.idNumber !== undefined ? str(body.idNumber).trim() || null : undefined;
    const address = body.address !== undefined ? str(body.address).trim().replace(/\s+/g, " ") || null : undefined;
    const phone = body.phoneNumber !== undefined ? normalizePhone(body.phoneNumber) || null : undefined;

    if (fullName !== undefined) {
      const e = fullNameError(fullName);
      if (e) fail("VALIDATION", e);
    }
    if (dobRaw !== undefined) {
      const e = dobError(dobRaw);
      if (e) fail("VALIDATION", e);
    }
    const dob = dobRaw ?? undefined;
    const lenErr = tooLong(address, 1000, "Địa chỉ liên hệ");
    if (lenErr) fail("VALIDATION", lenErr);
    if (gender !== undefined && gender !== null && !["NAM", "NU", "KHAC"].includes(gender)) fail("VALIDATION", "Giới tính không hợp lệ.");
    if (idNumber && !/^\d{12}$/.test(idNumber)) fail("VALIDATION", "Số CCCD phải gồm đúng 12 chữ số.");
    if (phone && !isVnPhone(phone)) fail("VALIDATION", "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.");

    // Đã nộp hồ sơ: không tự sửa được thông tin nhận dạng (họ tên, ngày sinh, giới tính, số CCCD) —
    // đó là thông tin cán bộ đã thẩm định và thí sinh đã cam kết. SĐT, địa chỉ liên hệ vẫn sửa được.
    const current = me.candidateId
      ? await this.prisma.candidate.findUnique({
          where: { candidate_id: BigInt(me.candidateId) },
          include: { candidate_account: true, application: { where: { deleted_at: null, is_cancelled: false } } },
        })
      : null;
    const apps = current?.application ?? [];
    const submitted = apps.filter((a) => a.review_status !== "DRAFT");
    const identityChanged =
      !!current &&
      ((fullName !== undefined && fullName !== current.full_name) ||
        (dob !== undefined && ymd(dob) !== ymd(current.dob)) ||
        // Bổ sung mục đang trống thì không tính là sửa
        (gender !== undefined && !!current.gender && gender !== current.gender) ||
        (idNumber !== undefined && !!current.id_number && idNumber !== current.id_number));
    if (identityChanged && submitted.length)
      fail(
        "PROFILE_LOCKED",
        `Hồ sơ ${submitted.map((a) => a.application_code).join(", ")} đã nộp nên không sửa được họ tên, ngày sinh, giới tính, số CCCD. Cần đính chính thì gửi yêu cầu ở mục Khiếu nại.`,
        HttpStatus.CONFLICT,
      );
    const contactChanged =
      !!current &&
      ((phone !== undefined && phone !== current.candidate_account.phone_number) || (address !== undefined && address !== current.address));

    await this.prisma.$transaction(async (tx) => {
      if (phone !== undefined) {
        if (phone && !(await phoneAvailable(tx, phone, BigInt(me.accountId))))
          conflict("DUPLICATE_PHONE", "Số điện thoại đã được dùng cho tài khoản khác.");
        await tx.candidate_account.update({ where: { account_id: BigInt(me.accountId) }, data: { phone_number: phone } });
      }
      // Hồ sơ nháp đã tích cam kết mà thông tin khai thay đổi -> phải xem lại và tích cam kết lần nữa
      if (identityChanged || contactChanged) {
        const drafts = apps.filter((a) => a.review_status === "DRAFT" && a.declaration_confirmed_at).map((a) => a.application_id);
        if (drafts.length) await tx.application.updateMany({ where: { application_id: { in: drafts } }, data: { declaration_confirmed_at: null } });
      }
      if (idNumber && (await tx.candidate.count({ where: { id_number: idNumber, account_id: { not: BigInt(me.accountId) } } })))
        conflict("DUPLICATE_ID_NUMBER", "Số CCCD đã được dùng cho hồ sơ khác.");
      const data = {
        ...(fullName !== undefined ? { full_name: fullName } : {}),
        ...(dob !== undefined ? { dob } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(idNumber !== undefined ? { id_number: idNumber } : {}),
        ...(address !== undefined ? { address } : {}),
      };
      if (me.candidateId) {
        await tx.candidate.update({ where: { candidate_id: BigInt(me.candidateId) }, data });
      } else {
        if (!fullName || !dob) fail("VALIDATION", "Lần đầu khai hồ sơ cần có họ tên và ngày sinh.");
        await tx.candidate.create({ data: { ...data, full_name: fullName, dob, account_id: BigInt(me.accountId) } });
      }
    });
    return { success: true };
  }

  // ------------------------------------------------------------------ hồ sơ xét tuyển
  async myApplication(me: CandidateUser) {
    if (!me.candidateId) return null;
    const a = await this.currentApplication(me.candidateId);
    if (!a) return null;
    return {
      applicationId: id(a.application_id),
      applicationCode: a.application_code,
      reviewStatus: a.review_status,
      admissionStatus: a.admission_status,
      batchName: a.admission_batch_major.admission_batch.batch_name,
      majorName: a.admission_batch_major.admission_major.major_name,
      degreeLevel: a.admission_batch_major.admission_major.degree_level,
      submittedAt: iso(a.submitted_at),
    };
  }

  async myDocuments(me: CandidateUser) {
    if (!me.candidateId) return [];
    const a = await this.currentApplication(me.candidateId);
    if (!a) return [];
    const docs = await this.prisma.application_document.findMany({ where: { application_id: a.application_id }, orderBy: { document_id: "asc" } });
    return docs.map((d) => ({
      documentId: id(d.document_id),
      documentType: d.document_type,
      fileName: d.file_name,
      fileSizeKb: d.file_size_kb,
      verifyStatus: d.verify_status,
      verifyNote: d.verify_note,
      uploadedAt: isoReq(d.uploaded_at),
    }));
  }

  /**
   * Nộp minh chứng (UC-DK-03/04). Chỉ khi hồ sơ còn nháp hoặc đang được yêu cầu
   * bổ sung. Khi bổ sung: nộp lại đúng loại giấy tờ bị đánh dấu không hợp lệ sẽ
   * THAY tệp cũ và đưa về "chưa kiểm tra". Giới hạn 5MB/tệp; tổng 30MB/hồ sơ do
   * trigger trg_document_size_limit của CSDL chặn lần cuối.
   */
  async upload(me: CandidateUser, applicationId: number, documentType: string, file: UploadedFileLike | undefined) {
    const candidateId = this.requireProfile(me);
    if (!file) fail("FILE_REQUIRED", "Chưa chọn tệp.");
    if (!DOC_TYPES.includes(documentType)) fail("VALIDATION", "Loại minh chứng không hợp lệ.");
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) fail("FILE_TYPE", "Chỉ nhận tệp PDF, JPG hoặc PNG.");
    // Không tin phần đuôi/kiểu do trình duyệt khai: kiểm tra chữ ký đầu tệp
    const head = file.buffer.subarray(0, 8);
    const looksRight =
      (ext === ".pdf" && head.subarray(0, 4).toString("latin1") === "%PDF") ||
      (ext === ".png" && head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (ext === ".jpg" && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
    if (!looksRight) fail("FILE_TYPE", "Nội dung tệp không đúng định dạng PDF/JPG/PNG.");
    const maxKb = await this.config.int("MAX_FILE_KB", 5120);
    const sizeKb = Math.max(1, Math.ceil(file.size / 1024));
    if (sizeKb > maxKb) fail("FILE_TOO_LARGE", `Tệp vượt quá ${Math.round(maxKb / 1024)}MB, vui lòng chọn tệp khác.`);

    const app = await this.prisma.application.findFirst({ where: { application_id: BigInt(applicationId), candidate_id: BigInt(candidateId), deleted_at: null } });
    if (!app) notFound("Không tìm thấy hồ sơ.");
    if (!["DRAFT", "NEEDS_SUPPLEMENT"].includes(app.review_status))
      fail("INVALID_STATE", "Hồ sơ đang được thẩm định, chỉ nộp thêm minh chứng khi có yêu cầu bổ sung.", HttpStatus.CONFLICT);

    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const rel = path.posix.join(String(applicationId), `${randomUUID()}${ext}`);
    await saveFile(this.prisma, rel, file.buffer);
    // multer/busboy đọc tên tệp theo latin1 -> đổi lại UTF-8 để giữ dấu tiếng Việt
    const original = Buffer.from(file.originalname, "latin1").toString("utf8");
    const fileName = original.normalize("NFC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || `minh_chung${ext}`;

    try {
      const duplicate = await this.prisma.application_document.count({ where: { application_id: app.application_id, file_hash: hash } });
      const replace =
        app.review_status === "NEEDS_SUPPLEMENT"
          ? await this.prisma.application_document.findFirst({ where: { application_id: app.application_id, document_type: documentType, verify_status: "INVALID" } })
          : null;
      const saved = await this.prisma.$transaction(async (tx) => {
        // Thay trigger #2: giới hạn tổng dung lượng minh chứng ≤ 30MB (Filess.io free không có TRIGGER)
        if (!replace) {
          const agg = await tx.application_document.aggregate({
            where: { application_id: app.application_id },
            _sum: { file_size_kb: true },
          });
          const totalKb = (agg._sum.file_size_kb ?? 0) + sizeKb;
          if (totalKb > 30720) fail("TOTAL_SIZE_EXCEEDED", "Tổng dung lượng minh chứng của một hồ sơ vượt quá 30MB theo quy định.");
        } else {
          // Khi nộp lại: trừ dung lượng file cũ rồi cộng file mới
          const agg = await tx.application_document.aggregate({
            where: { application_id: app.application_id, document_id: { not: replace.document_id } },
            _sum: { file_size_kb: true },
          });
          const totalKb = (agg._sum.file_size_kb ?? 0) + sizeKb;
          if (totalKb > 30720) fail("TOTAL_SIZE_EXCEEDED", "Tổng dung lượng minh chứng của một hồ sơ vượt quá 30MB theo quy định.");
        }
        const data = { file_name: fileName, file_path: rel, file_hash: hash, file_size_kb: sizeKb, verify_status: "PENDING", verify_note: null, verified_by_staff_id: null, verified_at: null, uploaded_at: new Date() };
        const doc = replace
          ? await tx.application_document.update({ where: { document_id: replace.document_id }, data })
          : await tx.application_document.create({ data: { ...data, application_id: app.application_id, document_type: documentType } });
        await this.audit.record({ type: "CANDIDATE", id: candidateId }, "DOCUMENT_UPLOAD", { table: "application_document", id: doc.document_id }, `${app.application_code}: ${replace ? "nộp lại" : "nộp"} ${fileName}`, tx);
        return doc;
      });
      if (replace) removeFile(this.prisma, replace.file_path);
      // Trùng tệp đã nộp trong cùng hồ sơ: cảnh báo, không chặn (thiết kế M3)
      return { success: true, documentId: id(saved.document_id), duplicateWarning: duplicate > 0 };
    } catch (e) {
      removeFile(this.prisma, rel);
      throw e;
    }
  }

  /** Thí sinh xác nhận đã bổ sung xong -> hồ sơ quay lại bước thẩm định */
  async submitSupplement(me: CandidateUser) {
    const candidateId = this.requireProfile(me);
    const a = await this.currentApplication(candidateId);
    if (!a || a.review_status !== "NEEDS_SUPPLEMENT") fail("INVALID_STATE", "Hồ sơ không ở trạng thái chờ bổ sung.", HttpStatus.CONFLICT);
    const pending = await this.prisma.supplement_request.findFirst({ where: { application_id: a.application_id, status: "PENDING" }, orderBy: { request_id: "desc" } });
    if (pending && pending.deadline < new Date()) fail("SUPPLEMENT_EXPIRED", "Đã quá hạn bổ sung hồ sơ.", HttpStatus.CONFLICT);
    const stillInvalid = await this.prisma.application_document.count({ where: { application_id: a.application_id, verify_status: "INVALID" } });
    if (stillInvalid) fail("SUPPLEMENT_INCOMPLETE", `Còn ${stillInvalid} minh chứng không hợp lệ chưa được nộp lại.`);
    await this.prisma.$transaction(async (tx) => {
      await this.apps.changeStatus(tx, id(a.application_id), "NEEDS_SUPPLEMENT", "UNDER_REVIEW", { type: "CANDIDATE" }, "Thí sinh đã nộp bổ sung");
      if (pending) await tx.supplement_request.update({ where: { request_id: pending.request_id }, data: { status: "RESOLVED", responded_at: new Date() } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "SUPPLEMENT_SUBMIT", { table: "supplement_request", id: pending?.request_id ?? null }, `${a.application_code}: thí sinh nộp bổ sung`, tx);
    });
    return { success: true };
  }

  async supervisorRequest(me: CandidateUser) {
    if (!me.candidateId) return null;
    const a = await this.currentApplication(me.candidateId);
    if (!a) return null;
    const r = await this.prisma.supervisor_request.findFirst({
      where: { research_proposal: { application_id: a.application_id } },
      orderBy: { request_id: "desc" },
      include: { lecturer: true },
    });
    if (!r) return null;
    return {
      requestId: id(r.request_id),
      lecturerName: r.lecturer.full_name,
      facultyName: r.lecturer.faculty_name ?? "",
      status: r.status,
      requestedAt: isoReq(r.requested_at),
      respondedAt: iso(r.responded_at),
      responseNote: r.response_note,
    };
  }

  async complaint(me: CandidateUser, body: Record<string, unknown>) {
    const candidateId = this.requireProfile(me);
    const type = str(body.type);
    const content = str(body.content).trim();
    const code = str(body.applicationCode).trim();
    if (!COMPLAINT_TYPES.includes(type)) fail("VALIDATION", "Loại khiếu nại không hợp lệ.");
    if (content.length < 20) fail("VALIDATION", "Nội dung cần ít nhất 20 ký tự để cán bộ xử lý được.");
    let applicationId: bigint | null = null;
    if (code) {
      const a = await this.prisma.application.findFirst({ where: { application_code: code, candidate_id: BigInt(candidateId) } });
      if (!a) fail("VALIDATION", "Mã hồ sơ không đúng hoặc không thuộc tài khoản của bạn.");
      applicationId = a.application_id;
    }
    const c = await this.prisma.$transaction(async (tx) => {
      const row = await tx.complaint.create({ data: { candidate_id: BigInt(candidateId), application_id: applicationId, complaint_type: type, content } });
      await this.audit.record({ type: "CANDIDATE", id: candidateId }, "COMPLAINT_SUBMIT", { table: "complaint", id: row.complaint_id }, `${type}${code ? `, hồ sơ ${code}` : ""}`, tx);
      await this.audit.notifyCandidate(candidateId, "Đã nhận khiếu nại", `Nhà trường đã nhận yêu cầu của bạn${code ? ` (hồ sơ ${code})` : ""}. Bạn theo dõi trạng thái và câu trả lời tại mục Khiếu nại trên cổng thí sinh.`, tx);
      return row;
    });
    return { success: true, complaintId: id(c.complaint_id) };
  }

  async notifications(me: CandidateUser) {
    if (!me.candidateId) return [];
    const rows = await this.prisma.notification.findMany({
      where: { recipient_type: "CANDIDATE", recipient_id: BigInt(me.candidateId), channel: "SYSTEM" },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return rows.map((n) => ({ notificationId: id(n.notification_id), title: n.title, content: n.content, createdAt: isoReq(n.created_at), readAt: iso(n.read_at) }));
  }

  /** Đánh dấu đã đọc 1 thông báo (notificationId) hoặc tất cả (null) */
  async markRead(me: CandidateUser, notificationId: number | null) {
    if (!me.candidateId) return { updated: 0 };
    const r = await this.prisma.notification.updateMany({
      where: {
        recipient_type: "CANDIDATE",
        recipient_id: BigInt(me.candidateId),
        channel: "SYSTEM",
        read_at: null,
        ...(notificationId !== null ? { notification_id: BigInt(notificationId) } : {}),
      },
      data: { read_at: new Date() },
    });
    return { updated: r.count };
  }
}
