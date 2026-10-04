import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit.service";
import type { StaffUser } from "../../common/auth";
import { fail, notFound } from "../../common/errors";
import { id, iso, isoReq, toInt, ymd } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";

type Status = "ACTIVE" | "PENDING_VERIFY" | "LOCKED";

/** CCCD trong danh sách chỉ hiện 3 số cuối; xem đủ trong trang chi tiết */
function maskId(v: string | null) {
  return v ? `${"•".repeat(Math.max(0, v.length - 3))}${v.slice(-3)}` : null;
}

/**
 * Quản lý tài khoản thí sinh (phía cán bộ): ai đã đăng ký, thông tin cá nhân, hồ sơ đã nộp.
 * Quản trị được khóa / mở khóa. Không xóa tài khoản thí sinh để giữ lịch sử hồ sơ.
 * Khóa = candidate_account.status "LOCKED" (khác khóa tạm do sai mật khẩu, dùng locked_until).
 */
@Injectable()
export class CandidateAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async where(q: Record<string, string | undefined>, withStatus = true): Promise<Prisma.candidate_accountWhereInput> {
    const and: Prisma.candidate_accountWhereInput[] = [{ deleted_at: null }];
    const text = (q.q ?? "").trim();
    if (text)
      and.push({
        OR: [
          { email: { contains: text } },
          { phone_number: { contains: text } },
          { candidate: { full_name: { contains: text } } },
          { candidate: { id_number: { contains: text } } },
          { candidate: { application: { some: { application_code: { contains: text } } } } },
        ],
      });
    if (withStatus && q.status && ["ACTIVE", "PENDING_VERIFY", "LOCKED"].includes(q.status)) and.push({ status: q.status });
    if (q.profile === "missing") and.push({ candidate: { is: null } });
    if (q.profile === "done") and.push({ candidate: { isNot: null } });
    if (q.application === "yes") and.push({ candidate: { application: { some: { is_cancelled: false, deleted_at: null, review_status: { not: "DRAFT" } } } } });
    if (q.application === "no") and.push({ NOT: { candidate: { application: { some: { is_cancelled: false, deleted_at: null, review_status: { not: "DRAFT" } } } } } });
    return { AND: and };
  }

  private latestApp = {
    where: { is_cancelled: false, deleted_at: null },
    orderBy: { application_id: "desc" as const },
    take: 1,
    include: { admission_batch_major: { include: { admission_major: true } } },
  };

  async list(q: Record<string, string | undefined>) {
    const page = Math.max(1, toInt(q.page, 1));
    const pageSize = Math.min(100, Math.max(5, toInt(q.pageSize, 20)));
    const where = await this.where(q);
    const [total, rows, grouped, all] = await Promise.all([
      this.prisma.candidate_account.count({ where }),
      this.prisma.candidate_account.findMany({
        where,
        orderBy: { account_id: q.sort === "oldest" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { candidate: { include: { application: this.latestApp } } },
      }),
      this.prisma.candidate_account.groupBy({ by: ["status"], where: await this.where(q, false), _count: { _all: true } }),
      this.prisma.candidate_account.count({ where: await this.where(q, false) }),
    ]);
    const counts: Record<string, number> = { ALL: all, ACTIVE: 0, PENDING_VERIFY: 0, LOCKED: 0 };
    grouped.forEach((g) => (counts[g.status] = g._count._all));
    return {
      page,
      pageSize,
      total,
      counts,
      items: rows.map((a) => {
        const c = a.candidate;
        const app = c?.application[0] ?? null;
        return {
          accountId: id(a.account_id),
          candidateId: c ? id(c.candidate_id) : null,
          fullName: c?.full_name ?? null,
          email: a.email,
          phoneNumber: a.phone_number,
          idNumberMasked: maskId(c?.id_number ?? null),
          status: a.status as Status,
          hasPassword: Boolean(a.password_hash),
          tempLockedUntil: a.locked_until && a.locked_until > new Date() ? isoReq(a.locked_until) : null,
          createdAt: isoReq(a.created_at),
          profileComplete: Boolean(c && c.full_name && c.dob && c.gender && c.id_number && c.address && a.phone_number),
          application: app
            ? { applicationId: id(app.application_id), applicationCode: app.application_code, reviewStatus: app.review_status, majorName: app.admission_batch_major.admission_major.major_name }
            : null,
        };
      }),
    };
  }

  async detail(accountId: number) {
    const a = await this.prisma.candidate_account.findFirst({
      where: { account_id: BigInt(accountId), deleted_at: null },
      include: {
        candidate: {
          include: {
            application: {
              where: { deleted_at: null },
              orderBy: { application_id: "desc" },
              include: { admission_batch_major: { include: { admission_batch: true, admission_major: true } }, application_payment: { orderBy: { payment_id: "desc" }, take: 1 } },
            },
            complaint: { orderBy: { complaint_id: "desc" }, take: 20 },
          },
        },
      },
    });
    if (!a) notFound("Không tìm thấy tài khoản thí sinh.");
    const c = a.candidate;
    const verified = await this.prisma.otp_verification.count({ where: { account_id: a.account_id, purpose: "REGISTER", verified_at: { not: null } } });
    const logs = await this.prisma.audit_log.findMany({
      where: { entity_table: "candidate_account", entity_id: a.account_id, action: { in: ["CANDIDATE_LOCK", "CANDIDATE_UNLOCK"] } },
      orderBy: { created_at: "desc" },
      take: 20,
    });
    const staffIds = Array.from(new Set(logs.filter((l) => l.actor_type === "STAFF" && l.actor_id).map((l) => l.actor_id as bigint)));
    const staff = staffIds.length ? await this.prisma.staff_account.findMany({ where: { staff_account_id: { in: staffIds } }, select: { staff_account_id: true, full_name: true } }) : [];
    const staffName = (sid: bigint | null) => staff.find((s) => s.staff_account_id === sid)?.full_name ?? "Hệ thống";

    return {
      account: {
        accountId: id(a.account_id),
        email: a.email,
        phoneNumber: a.phone_number,
        status: a.status as Status,
        hasPassword: Boolean(a.password_hash),
        // Đăng ký bằng email thì nhập đúng mã mới kích hoạt; đăng nhập Google thì Google đã xác thực
        emailVerified: verified > 0 || (a.status !== "PENDING_VERIFY" && !a.password_hash),
        createdAt: isoReq(a.created_at),
        failedLoginCount: a.failed_login_count,
        tempLockedUntil: a.locked_until && a.locked_until > new Date() ? isoReq(a.locked_until) : null,
      },
      profile: c
        ? {
            candidateId: id(c.candidate_id),
            fullName: c.full_name,
            dob: ymd(c.dob),
            gender: c.gender,
            idNumber: c.id_number,
            address: c.address,
            nationality: c.nationality,
          }
        : null,
      applications: (c?.application ?? []).map((x) => ({
        applicationId: id(x.application_id),
        applicationCode: x.application_code,
        batchName: x.admission_batch_major.admission_batch.batch_name,
        majorName: x.admission_batch_major.admission_major.major_name,
        degreeLevel: x.admission_batch_major.admission_batch.degree_level,
        reviewStatus: x.review_status,
        admissionStatus: x.admission_status,
        isCancelled: x.is_cancelled,
        createdAt: isoReq(x.created_at),
        submittedAt: iso(x.submitted_at),
        paymentStatus: x.application_payment[0]?.gateway_status ?? null,
      })),
      complaints: (c?.complaint ?? []).map((x) => ({ complaintId: id(x.complaint_id), type: x.complaint_type, status: x.status, createdAt: isoReq(x.created_at) })),
      lockHistory: logs.map((l) => ({ action: l.action, detail: l.detail, by: l.actor_type === "STAFF" ? staffName(l.actor_id) : "Hệ thống", at: isoReq(l.created_at) })),
    };
  }

  async lock(me: StaffUser, accountId: number, reason: unknown) {
    const why = String(reason ?? "").trim();
    if (why.length < 5) fail("REASON_REQUIRED", "Nhập lý do khóa (ít nhất 5 ký tự). Lý do được gửi cho thí sinh và ghi vào nhật ký.");
    const a = await this.prisma.candidate_account.findFirst({ where: { account_id: BigInt(accountId), deleted_at: null }, include: { candidate: true } });
    if (!a) notFound("Không tìm thấy tài khoản thí sinh.");
    if (a.status === "LOCKED") fail("ALREADY_LOCKED", "Tài khoản này đang bị khóa.", HttpStatus.CONFLICT);
    const who = a.candidate?.full_name ?? a.email ?? `#${accountId}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.candidate_account.update({ where: { account_id: a.account_id }, data: { status: "LOCKED" } });
      await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "CANDIDATE_LOCK", { table: "candidate_account", id: a.account_id }, `Khóa tài khoản thí sinh ${who}: ${why.slice(0, 400)}`, tx);
      if (a.candidate)
        await this.audit.notifyCandidate(
          id(a.candidate.candidate_id),
          "Tài khoản của bạn đã bị tạm khóa",
          `Tài khoản tuyển sinh sau đại học của bạn đã bị khóa. Lý do: ${why.slice(0, 400)}\nHồ sơ đã nộp (nếu có) vẫn được giữ nguyên. Liên hệ Phòng Đào tạo Sau đại học, Trường Đại học An Giang để được hỗ trợ.`,
          tx,
        );
    });
    return { success: true };
  }

  async unlock(me: StaffUser, accountId: number) {
    const a = await this.prisma.candidate_account.findFirst({ where: { account_id: BigInt(accountId), deleted_at: null }, include: { candidate: true } });
    if (!a) notFound("Không tìm thấy tài khoản thí sinh.");
    const tempLocked = a.locked_until && a.locked_until > new Date();
    if (a.status !== "LOCKED" && !tempLocked) fail("NOT_LOCKED", "Tài khoản này không bị khóa.", HttpStatus.CONFLICT);
    // Mở khóa về đúng trạng thái trước đó: chưa xác thực email thì vẫn phải nhập mã
    const verified =
      (await this.prisma.otp_verification.count({ where: { account_id: a.account_id, purpose: "REGISTER", verified_at: { not: null } } })) > 0 || !a.password_hash;
    const who = a.candidate?.full_name ?? a.email ?? `#${accountId}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.candidate_account.update({
        where: { account_id: a.account_id },
        data: { status: a.status === "LOCKED" ? (verified ? "ACTIVE" : "PENDING_VERIFY") : a.status, failed_login_count: 0, locked_until: null },
      });
      await this.audit.record(
        { type: "STAFF", id: me.staffAccountId },
        "CANDIDATE_UNLOCK",
        { table: "candidate_account", id: a.account_id },
        a.status === "LOCKED" ? `Mở khóa tài khoản thí sinh ${who}` : `Gỡ khóa tạm (đăng nhập sai nhiều lần) cho ${who}`,
        tx,
      );
      if (a.status === "LOCKED" && a.candidate)
        await this.audit.notifyCandidate(id(a.candidate.candidate_id), "Tài khoản của bạn đã được mở khóa", "Tài khoản tuyển sinh sau đại học của bạn đã được mở khóa. Bạn có thể đăng nhập lại bình thường.", tx);
    });
    return { success: true };
  }

  /** Xuất danh sách (theo bộ lọc hiện tại) ra CSV mở được bằng Excel; ghi nhật ký vì có dữ liệu cá nhân */
  async exportCsv(me: StaffUser, q: Record<string, string | undefined>) {
    const rows = await this.prisma.candidate_account.findMany({
      where: await this.where(q),
      orderBy: { account_id: "asc" },
      take: 5000,
      include: { candidate: { include: { application: this.latestApp } } },
    });
    const STATUS_VI: Record<string, string> = { ACTIVE: "Hoạt động", PENDING_VERIFY: "Chưa xác thực email", LOCKED: "Bị khóa" };
    const REVIEW_VI: Record<string, string> = { DRAFT: "Nháp, chưa nộp", SUBMITTED: "Chờ tiếp nhận", UNDER_REVIEW: "Đang thẩm định", NEEDS_SUPPLEMENT: "Chờ bổ sung", APPROVED: "Đạt thẩm định", REJECTED: "Không đạt" };
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      // Chặn công thức Excel (=, +, -, @) và bọc dấu ngoặc kép
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const head = ["STT", "Họ và tên", "Ngày sinh", "Giới tính", "Số CCCD", "Email", "Điện thoại", "Địa chỉ", "Trạng thái tài khoản", "Ngày đăng ký", "Mã hồ sơ gần nhất", "Ngành", "Trạng thái hồ sơ"];
    const lines = rows.map((a, i) => {
      const c = a.candidate;
      const app = c?.application[0];
      return [
        i + 1,
        c?.full_name,
        c ? ymd(c.dob) : "",
        c?.gender === "NAM" ? "Nam" : c?.gender === "NU" ? "Nữ" : c?.gender ? "Khác" : "",
        c?.id_number,
        a.email,
        a.phone_number,
        c?.address,
        STATUS_VI[a.status] ?? a.status,
        a.created_at.toISOString().slice(0, 10),
        app?.application_code,
        app?.admission_batch_major.admission_major.major_name,
        app ? REVIEW_VI[app.review_status] ?? app.review_status : "",
      ]
        .map(cell)
        .join(",");
    });
    await this.audit.record({ type: "STAFF", id: me.staffAccountId }, "CANDIDATE_EXPORT", { table: "candidate_account", id: null }, `Xuất danh sách ${rows.length} tài khoản thí sinh ra tệp CSV`);
    // BOM để Excel đọc đúng tiếng Việt
    return "﻿" + [head.map(cell).join(","), ...lines].join("\r\n");
  }
}
