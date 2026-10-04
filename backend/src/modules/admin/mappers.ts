// Chuyển bản ghi Prisma (snake_case, BigInt, Decimal) sang đúng kiểu dữ liệu
// frontend đang dùng (frontend/web/src/lib/admin/types.ts).
import type { Prisma } from "@prisma/client";
import { dec, id, iso, isoReq, num, parseReviewStatus } from "../../common/util";

type StaffWithRoles = Prisma.staff_accountGetPayload<{ include: { staff_role: { include: { role: true } } } }>;

export function toStaffDto(s: StaffWithRoles) {
  return {
    staffAccountId: id(s.staff_account_id),
    staffCode: s.staff_code,
    fullName: s.full_name,
    email: s.email,
    hasPassword: !!s.password_hash,
    mustChangePassword: s.must_change_password,
    status: s.status,
    deletedAt: iso(s.deleted_at),
    roles: s.staff_role.map((r) => r.role.role_code),
  };
}

export function toBatchDto(b: Prisma.admission_batchGetPayload<object>) {
  return {
    batchId: id(b.batch_id),
    batchCode: b.batch_code,
    batchName: b.batch_name,
    degreeLevel: b.degree_level,
    registrationStartAt: isoReq(b.registration_start_at),
    registrationEndAt: isoReq(b.registration_end_at),
    examStartAt: iso(b.exam_start_at),
    examEndAt: iso(b.exam_end_at),
    legalBasis: b.legal_basis,
    status: b.status,
    createdAt: isoReq(b.created_at),
  };
}

export function toMajorDto(m: Prisma.admission_majorGetPayload<object>) {
  return {
    majorId: id(m.major_id),
    majorCode: m.major_code,
    majorName: m.major_name,
    degreeLevel: m.degree_level,
    facultyName: m.faculty_name ?? "",
  };
}

type BmFull = Prisma.admission_batch_majorGetPayload<{ include: { exam_subject: true; admission_condition: true } }>;

export function toBatchMajorDto(bm: BmFull) {
  return {
    batchMajorId: id(bm.batch_major_id),
    batchId: id(bm.batch_id),
    majorId: id(bm.major_id),
    quota: bm.quota,
    benchmarkScore: dec(bm.benchmark_score),
    status: bm.status,
    approvedByStaffId: num(bm.approved_by_staff_id),
    subjects: bm.exam_subject.map((s) => ({
      subjectId: id(s.subject_id),
      subjectName: s.subject_name,
      examFormat: s.exam_format,
      weight: Number(s.weight),
      maxScore: Number(s.max_score),
    })),
    conditions: bm.admission_condition.map((c) => ({
      conditionId: id(c.condition_id),
      conditionCode: c.condition_code,
      description: c.description,
      minGpa: dec(c.min_gpa),
      requiredCertificate: c.required_certificate,
      isMandatory: c.is_mandatory,
    })),
  };
}

export function toHistoryDto(h: Prisma.application_status_historyGetPayload<object>) {
  return {
    historyId: id(h.history_id),
    oldStatus: parseReviewStatus(h.old_status),
    newStatus: parseReviewStatus(h.new_status),
    changedByType: h.changed_by_type,
    changedByStaffId: num(h.changed_by_staff_id),
    reason: h.reason,
    changedAt: isoReq(h.changed_at),
  };
}

export function toAuditDto(l: Prisma.audit_logGetPayload<object>) {
  return {
    logId: id(l.log_id),
    actorType: l.actor_type,
    actorId: num(l.actor_id),
    action: l.action,
    entityTable: l.entity_table,
    entityId: num(l.entity_id),
    detail: l.detail,
    createdAt: isoReq(l.created_at),
  };
}
