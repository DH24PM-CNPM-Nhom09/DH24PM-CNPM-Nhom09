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
import { ApplicationsService } from "../admin/applications.service";

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
      accountCreatedAt: isoReq(account.created_at),
      hasPassword: Boolean(account.password_hash),
    };
  }

  async updateProfile(me: CandidateUser, body: Record<string, unknown>) {
    const fullName = body.fullName !== undefined ? str(body.fullName).trim() : undefined;
    const dob = body.dob !== undefined ? new Date(str(body.dob)) : undefined;
    const gender = body.gender !== undefined ? (body.gender === null ? null : str(body.gender)) : undefined;
    const idNumber = body.idNumber !== undefined ? str(body.idNumber).trim() || null : undefined;
    const address = body.address !== undefined ? str(body.address).trim() || null : undefined;
    const phone = body.phoneNumber !== undefined ? str(body.phoneNumber).replace(/\s/g, "") || null : undefined;

    if (fullName !== undefined && fullName.length < 2) fail("VALIDATION", "Họ tên không hợp lệ.");
    if (dob !== undefined) {
      if (Number.isNaN(dob.getTime())) fail("VALIDATION", "Ngày sinh không hợp lệ.");
      const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
      if (age < 18 || age > 80) fail("VALIDATION", "Ngày sinh không hợp lệ (thí sinh phải từ 18 tuổi).");
    }
    if (gender !== undefined && gender !== null && !["NAM", "NU", "KHAC"].includes(gender)) fail("VALIDATION", "Giới tính không hợp lệ.");
    if (idNumber && !/^\d{12}$/.test(idNumber)) fail("VALIDATION", "Số CCCD phải gồm đúng 12 chữ số.");
    if (phone && !/^0\d{9}$/.test(phone)) fail("VALIDATION", "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.");

    await this.prisma.$transaction(async (tx) => {
      if (phone !== undefined) {
        if (phone && (await tx.candidate_account.count({ where: { phone_number: phone, account_id: { not: BigInt(me.accountId) } } })))
          conflict("DUPLICATE_PHONE", "Số điện thoại đã được dùng cho tài khoản khác.");
        await tx.candidate_account.update({ where: { account_id: BigInt(me.accountId) }, data: { phone_number: phone } });
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
    const root = path.resolve(env.uploadDir());
    fs.mkdirSync(path.join(root, String(applicationId)), { recursive: true });
    const abs = path.join(root, rel);
    fs.writeFileSync(abs, file.buffer);
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
        const data = { file_name: fileName, file_path: rel, file_hash: hash, file_size_kb: sizeKb, verify_status: "PENDING", verify_note: null, verified_by_staff_id: null, verified_at: null, uploaded_at: new Date() };
        const doc = replace
          ? await tx.application_document.update({ where: { document_id: replace.document_id }, data })
          : await tx.application_document.create({ data: { ...data, application_id: app.application_id, document_type: documentType } });
        await this.audit.record({ type: "CANDIDATE", id: candidateId }, "DOCUMENT_UPLOAD", { table: "application_document", id: doc.document_id }, `${app.application_code}: ${replace ? "nộp lại" : "nộp"} ${fileName}`, tx);
        return doc;
      });
      if (replace) {
        const old = path.resolve(root, replace.file_path);
        if (old.startsWith(root + path.sep)) fs.rm(old, { force: true }, () => undefined);
      }
      // Trùng tệp đã nộp trong cùng hồ sơ: cảnh báo, không chặn (thiết kế M3)
      return { success: true, documentId: id(saved.document_id), duplicateWarning: duplicate > 0 };
    } catch (e) {
      fs.rm(abs, { force: true }, () => undefined);
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
