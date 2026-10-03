/**
 * Ma tran phan quyen RBAC theo role_code.
 *
 * Theo migration_v3_GD3.sql - hang 4: DB CHỈ dừng ở cap Role (bang role /
 * staff_role), KHONG co bang permission chi tiet. Quyen han theo tung
 * hanh dong duoc khai bao BANG CODE tai day va enforce boi RbacGuard.
 *
 * Nhom QA (Lam Hoai An) viet test case dua tren ma tran nay, khong dua tren
 * schema DB.
 */
export const PERMISSION_MATRIX: Record<string, string[]> = {
  ADMIN: ['*'],
  TEAM_LEAD: ['*'],
  CAN_BO_TUYEN_SINH: [
    'admission-config:manage',
    'application:review',
    'application:supplement-request',
    'exam:manage',
    'notification:send',
  ],
  HOI_DONG_TUYEN_SINH: [
    'admission-result:build-ranking',
    'admission-result:apply-benchmark',
    'admission-result:approve-level1',
    'exam:score-appeal',
  ],
  LANH_DAO: [
    'admission-result:approve-level2',
    'admission-result:publish',
    'decision:issue',
  ],
  GIAM_KHAO: ['exam:enter-score'],
  GIANG_VIEN: ['research-proposal:respond-supervisor-request'],
  NHAN_VIEN_XAC_MINH: [
    'decision-enrollment:verify-original-document',
    'decision-enrollment:finalize',
  ],
};

export function hasPermission(roleCodes: string[], permission: string): boolean {
  return roleCodes.some((code) => {
    const granted = PERMISSION_MATRIX[code] ?? [];
    return granted.includes('*') || granted.includes(permission);
  });
}
