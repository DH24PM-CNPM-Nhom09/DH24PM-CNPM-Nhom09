/** Map mã DB → enum Frontend (types.ts) */

export function toReviewStatus(db: string): string {
  const map: Record<string, string> = {
    NHAP: 'DRAFT',
    DRAFT: 'DRAFT',
    DA_NOP: 'SUBMITTED',
    SUBMITTED: 'SUBMITTED',
    DANG_THAM_DINH: 'UNDER_REVIEW',
    UNDER_REVIEW: 'UNDER_REVIEW',
    YEU_CAU_BO_SUNG: 'NEEDS_SUPPLEMENT',
    NEEDS_SUPPLEMENT: 'NEEDS_SUPPLEMENT',
    HOP_LE: 'APPROVED',
    APPROVED: 'APPROVED',
    TU_CHOI: 'REJECTED',
    REJECTED: 'REJECTED',
  };
  return map[db] ?? db;
}

export function toAdmissionStatus(db: string | null | undefined): string {
  if (!db) return 'NONE';
  const map: Record<string, string> = {
    NONE: 'NONE',
    CHO_XET: 'WAITLISTED',
    WAITLISTED: 'WAITLISTED',
    TRUNG_TUYEN: 'ADMITTED',
    ADMITTED: 'ADMITTED',
    DA_XAC_NHAN: 'CONFIRMED',
    CONFIRMED: 'CONFIRMED',
    DA_NHAP_HOC: 'ENROLLED',
    ENROLLED: 'ENROLLED',
  };
  return map[db] ?? 'NONE';
}

export function toSupervisorStatus(db: string): string {
  const map: Record<string, string> = {
    CHO_XAC_NHAN: 'PENDING',
    PENDING: 'PENDING',
    CHAP_NHAN: 'ACCEPTED',
    ACCEPTED: 'ACCEPTED',
    TU_CHOI: 'REJECTED',
    REJECTED: 'REJECTED',
  };
  return map[db] ?? 'PENDING';
}
