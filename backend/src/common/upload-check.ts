import { fail } from "./errors";

export interface UploadLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED: Record<string, string> = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png" };

/**
 * Kiểm tra tệp tải lên: chỉ PDF / JPG / PNG, đúng chữ ký đầu tệp (không tin đuôi tệp trình duyệt khai),
 * không quá maxKb. Trả về đuôi tệp, dung lượng KB và tên tệp đã làm sạch (giữ dấu tiếng Việt).
 */
export function checkUpload(file: UploadLike | undefined, maxKb: number, fallbackName: string) {
  if (!file) fail("FILE_REQUIRED", "Chưa chọn tệp.");
  const ext = ALLOWED[file.mimetype];
  if (!ext) fail("FILE_TYPE", "Chỉ nhận tệp PDF, JPG hoặc PNG.");
  const head = file.buffer.subarray(0, 8);
  const ok =
    (ext === ".pdf" && head.subarray(0, 4).toString("latin1") === "%PDF") ||
    (ext === ".png" && head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (ext === ".jpg" && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
  if (!ok) fail("FILE_TYPE", "Nội dung tệp không đúng định dạng PDF/JPG/PNG.");
  const sizeKb = Math.max(1, Math.ceil(file.size / 1024));
  if (sizeKb > maxKb) fail("FILE_TOO_LARGE", `Tệp vượt quá ${Math.round(maxKb / 1024)}MB, vui lòng chọn tệp khác.`);
  // multer đọc tên tệp theo latin1 -> đổi lại UTF-8 để giữ dấu tiếng Việt
  const original = Buffer.from(file.originalname, "latin1").toString("utf8");
  const fileName = original.normalize("NFC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || `${fallbackName}${ext}`;
  return { ext, sizeKb, fileName };
}
