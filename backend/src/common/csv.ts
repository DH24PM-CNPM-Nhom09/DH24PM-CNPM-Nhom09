/**
 * Một ô CSV mở bằng Excel: bọc dấu ngoặc kép, nhân đôi dấu ngoặc kép bên trong,
 * và chặn "CSV injection" — ô bắt đầu bằng = + - @ hoặc tab / CR / LF (kể cả sau khoảng trắng)
 * được thêm dấu nháy ' phía trước để Excel hiểu là chữ, không chạy như công thức.
 */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r\n]|^\s+[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
