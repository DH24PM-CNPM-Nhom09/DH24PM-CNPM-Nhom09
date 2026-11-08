// ============================================================================
// Kiểm tra / chuẩn hóa dữ liệu nhập — dùng chung cho đăng ký, sửa thông tin cá nhân, khai CCCD, cấu hình đợt...
// Có kiểm thử đơn vị: test/validate.test.ts (npm test).
// ============================================================================

/** Việt Nam dùng một múi giờ cố định UTC+7, không đổi giờ mùa hè */
export const VN_OFFSET_MINUTES = 7 * 60;

/**
 * Ngày dạng YYYY-MM-DD, kiểm tra NGÀY CÓ THẬT (không nhận 2008-02-30 rồi tự đổi thành 2008-03-01).
 * Trả về Date lúc 00:00 UTC của ngày đó, hoặc null nếu sai.
 */
export function parseYmd(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng {y, m, d} */
function todayVn(now: Date) {
  const v = new Date(now.getTime() + VN_OFFSET_MINUTES * 60_000);
  return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
}

/**
 * Số tuổi tròn theo lịch (đúng ngày sinh nhật là đủ tuổi), tính theo ngày ở Việt Nam.
 * Thay cho (now - dob) / 365.25 — công thức cũ làm người vừa tròn 18 tuổi hôm nay ra 17,9996 tuổi.
 * Sinh ngày 29/02: năm không nhuận tính đủ tuổi vào ngày 01/03.
 */
export function ageOn(dob: Date, now = new Date()): number {
  const t = todayVn(now);
  const by = dob.getUTCFullYear();
  const bm = dob.getUTCMonth() + 1;
  const bd = dob.getUTCDate();
  let age = t.y - by;
  if (t.m < bm || (t.m === bm && t.d < bd)) age--;
  return age;
}

/** Ngày sinh hợp lệ cho thí sinh: ngày có thật, từ 18 đến 80 tuổi. Trả câu lỗi hoặc null. */
export function dobError(dob: Date | null, now = new Date()): string | null {
  if (!dob) return "Ngày sinh không hợp lệ (nhập đúng ngày có thật).";
  const age = ageOn(dob, now);
  if (age < 18) return "Ngày sinh không hợp lệ: thí sinh phải từ 18 tuổi trở lên.";
  if (age > 80) return "Ngày sinh không hợp lệ.";
  return null;
}

export const FULL_NAME_MAX = 100;

/**
 * Chuẩn hóa họ tên: Unicode NFC (bàn phím Mac / iOS hay gửi dạng tổ hợp NFD), gộp khoảng trắng.
 * Cho phép chữ cái mọi ngôn ngữ, dấu gạch nối và dấu nháy đơn giữa các chữ (VD: "H'Hen Niê", "Nguyễn-Trần An").
 */
export function normalizeFullName(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/[’ʼ`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function fullNameError(name: string): string | null {
  if (name.length < 4) return "Nhập đầy đủ họ và tên, ví dụ: Nguyễn Văn An.";
  if (name.length > FULL_NAME_MAX) return `Họ và tên tối đa ${FULL_NAME_MAX} ký tự.`;
  // \p{M}: dấu kết hợp còn sót lại sau NFC (một số chữ dân tộc thiểu số)
  if (!/^[\p{L}\p{M}]+(?:['-]?[\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:['-]?[\p{L}\p{M}]+)*)*$/u.test(name))
    return "Họ và tên chỉ gồm chữ cái (có thể có dấu gạch nối hoặc dấu nháy), cách nhau bằng khoảng trắng, ví dụ: Nguyễn Văn An.";
  return null;
}

/** Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; +84 / 84 đầu số đổi thành 0 */
export function normalizePhone(raw: unknown): string {
  let p = String(raw ?? "").replace(/[\s.\-()]/g, "");
  if (/^\+84\d{9}$/.test(p)) p = "0" + p.slice(3);
  else if (/^84\d{9}$/.test(p)) p = "0" + p.slice(2);
  return p;
}

export const isVnPhone = (p: string) => /^0\d{9}$/.test(p);

/**
 * Ngày giờ từ client. Chuỗi CÓ múi giờ (…Z, …+07:00) giữ nguyên; chuỗi KHÔNG có múi giờ
 * (VD "2026-11-20T17:00" từ ô datetime-local, hoặc "2026-11-20") được hiểu là GIỜ VIỆT NAM —
 * trước đây máy chủ chạy UTC hiểu nhầm thành giờ UTC, lệch 7 tiếng.
 * Trả null nếu không đọc được hoặc ngày không có thật.
 */
export function parseDateTimeVn(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const local = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/.exec(s);
  if (local) {
    const day = parseYmd(local[1]);
    if (!day) return null;
    const [h, mi, se] = [Number(local[2] ?? 0), Number(local[3] ?? 0), Number(local[4] ?? 0)];
    if (h > 23 || mi > 59 || se > 59) return null;
    return new Date(day.getTime() + ((h * 60 + mi) * 60 + se) * 1000 - VN_OFFSET_MINUTES * 60_000);
  }
  // Có múi giờ: kiểm tra phần ngày có thật rồi để Date đọc
  const withZone = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.exec(s);
  if (!withZone || !parseYmd(withZone[1])) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cắt chuỗi về độ dài cột trong CSDL sau khi gộp khoảng trắng; trả câu lỗi nếu dài quá (thay vì lỗi 500) */
export function tooLong(value: string | null | undefined, max: number, label: string): string | null {
  return value && value.length > max ? `${label} tối đa ${max} ký tự (đang có ${value.length}).` : null;
}
