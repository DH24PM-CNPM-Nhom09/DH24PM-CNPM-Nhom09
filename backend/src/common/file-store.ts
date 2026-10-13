import * as fs from "fs";
import * as path from "path";
import type { PrismaClient } from "@prisma/client";
import { env } from "./config.service";

// ============================================================================
// Nơi lưu nội dung tệp minh chứng.
//   UPLOAD_STORAGE=disk (mặc định): ghi vào thư mục UPLOAD_DIR như trước.
//   UPLOAD_STORAGE=db  : ghi vào bảng stored_file (migration v13). Dùng khi máy chủ
//                        không có ổ đĩa lâu dài — VD Render bản miễn phí xóa sạch ổ đĩa
//                        mỗi lần dịch vụ ngủ / khởi động lại.
// Khóa của tệp luôn là application_document.file_path (đường dẫn tương đối) nên hai cách
// lưu dùng chung một cột, đổi qua lại không phải sửa dữ liệu hồ sơ.
// ============================================================================
type Db = Pick<PrismaClient, "stored_file">;

export const dbStorage = () => String(process.env.UPLOAD_STORAGE ?? "").trim().toLowerCase() === "db";

/** Đường dẫn tuyệt đối trên đĩa, chặn mọi đường dẫn thoát ra ngoài thư mục upload */
function diskPath(rel: string): string | null {
  const root = path.resolve(env.uploadDir());
  const abs = path.resolve(root, rel);
  return abs.startsWith(root + path.sep) ? abs : null;
}

export async function saveFile(prisma: Db, rel: string, buf: Buffer): Promise<void> {
  if (dbStorage()) {
    const content = new Uint8Array(buf);
    await prisma.stored_file.upsert({
      where: { file_path: rel },
      create: { file_path: rel, content, size_bytes: buf.length },
      update: { content, size_bytes: buf.length, created_at: new Date() },
    });
    return;
  }
  const abs = diskPath(rel);
  if (!abs) throw new Error("Đường dẫn tệp không hợp lệ.");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
}

/** Nội dung tệp; null nếu không còn (đọc ở CSDL trước, không có thì thử trên đĩa) */
export async function readFile(prisma: Db, rel: string): Promise<Buffer | null> {
  if (dbStorage()) {
    const row = await prisma.stored_file.findUnique({ where: { file_path: rel } });
    if (row) return Buffer.from(row.content);
  }
  const abs = diskPath(rel);
  return abs && fs.existsSync(abs) ? fs.readFileSync(abs) : null;
}

/** Xóa tệp (không báo lỗi nếu tệp đã không còn) */
export function removeFile(prisma: Db, rel: string): void {
  if (dbStorage()) {
    prisma.stored_file.deleteMany({ where: { file_path: rel } }).catch(() => undefined);
    return;
  }
  const abs = diskPath(rel);
  if (abs) fs.rm(abs, { force: true }, () => undefined);
}

/** Kiểu nội dung theo đuôi tệp (đuôi đã được kiểm tra khi tải lên: .pdf / .jpg / .png) */
export function contentType(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  return ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
}
