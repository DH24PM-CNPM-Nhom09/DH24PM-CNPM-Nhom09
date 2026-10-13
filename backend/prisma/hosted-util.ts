// Bản sao nhỏ của src/common/db-url.ts và src/common/file-store.ts cho các script trong prisma/
// (ảnh Docker chỉ có dist/, không có src/, nên script chạy bằng ts-node không import được từ src/).
import type { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

/** "...?ssl-mode=REQUIRED" (chuỗi của Aiven) -> "...?sslaccept=accept_invalid_certs" (Prisma hiểu được) */
export function normalizeDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url || !/[?&]ssl-?mode=/i.test(url) || /[?&]sslaccept=/i.test(url)) return;
  const [base, query = ""] = url.split("?");
  const params = query.split("&").filter((p) => p && !/^ssl-?mode=/i.test(p));
  if (/ssl-?mode=(required|verify_ca|verify_identity)/i.test(url)) params.push("sslaccept=accept_invalid_certs");
  process.env.DATABASE_URL = params.length ? `${base}?${params.join("&")}` : base;
}

export const dbStorage = () => String(process.env.UPLOAD_STORAGE ?? "").trim().toLowerCase() === "db";

/** Ghi tệp minh chứng mẫu: vào bảng stored_file (UPLOAD_STORAGE=db) hoặc thư mục UPLOAD_DIR */
export async function saveSeedFile(prisma: PrismaClient, uploadRoot: string, rel: string, buf: Buffer): Promise<void> {
  if (dbStorage()) {
    const content = new Uint8Array(buf);
    await prisma.stored_file.upsert({ where: { file_path: rel }, create: { file_path: rel, content, size_bytes: buf.length }, update: { content, size_bytes: buf.length } });
    return;
  }
  fs.mkdirSync(path.dirname(path.join(uploadRoot, rel)), { recursive: true });
  fs.writeFileSync(path.join(uploadRoot, rel), buf);
}
