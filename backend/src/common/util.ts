import { Prisma } from "@prisma/client";

/** BIGINT UNSIGNED -> number (id trong hệ thống nhỏ hơn 2^53 rất nhiều) */
export const num = (v: bigint | number | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
export const id = (v: bigint | number): number => Number(v);
/** DECIMAL -> number */
export const dec = (v: Prisma.Decimal | number | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
/** DATETIME (UTC) -> ISO string */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoReq = (d: Date): string => d.toISOString();
/** DATE -> "YYYY-MM-DD" */
export const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
}

/**
 * Trigger #9 của CSDL ghi old_status/new_status dạng
 * "review=UNDER_REVIEW;admission=NONE;cancelled=0". Hàm này lấy ra phần review.
 * Dòng do ứng dụng tự ghi (dữ liệu mẫu) có thể chỉ là "UNDER_REVIEW".
 */
export function parseReviewStatus(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/review=([A-Z_]+)/);
  return m ? m[1] : /^[A-Z_]+$/.test(s) ? s : null;
}
