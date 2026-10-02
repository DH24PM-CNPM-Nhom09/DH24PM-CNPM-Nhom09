/* eslint-disable no-console */
// ============================================================================
// npm run db:update — cập nhật CSDL ĐANG CÓ DỮ LIỆU lên bản mới nhất. Chạy lại nhiều lần vẫn an toàn.
//   1. Chạy database/migration_v5_announcement.sql (thêm cột cho bảng announcement — chỉ THÊM)
//   2. Sửa cột candidate.nationality bị lỗi font ("Viá»‡t Nam" -> "Việt Nam") do bản cũ ghi sai
//   3. Nạp thông báo tuyển sinh / quy định mẫu nếu bảng announcement còn trống
// Không xóa bất kỳ dòng hay cột nào.
// ============================================================================
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { seedAnnouncements } from "./announcements-seed";

const prisma = new PrismaClient();

function sqlStatements(file: string) {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !/^(SET NAMES|USE)\b/i.test(s));
}

(async () => {
  try {
    const file = path.join(__dirname, "..", "database", "migration_v5_announcement.sql");
    for (const stmt of sqlStatements(file)) await prisma.$executeRawUnsafe(stmt);
    console.log("✓ Đã chạy migration v5 (thêm cột category, is_pinned, updated_at cho bảng announcement).");

    const fixed = await prisma.$executeRawUnsafe("UPDATE candidate SET nationality = ? WHERE nationality = ?", "Việt Nam", "Viá»‡t Nam");
    console.log(fixed ? `✓ Đã sửa lỗi font quốc tịch cho ${fixed} thí sinh.` : "✓ Cột quốc tịch không có lỗi font.");

    const n = await seedAnnouncements(prisma);
    console.log(n ? `✓ Đã nạp ${n} thông báo mẫu (tuyển sinh, quy định, hướng dẫn).` : "✓ Bảng thông báo đã có dữ liệu, giữ nguyên.");
    console.log("\nXong. Khởi động lại backend (Ctrl+C rồi npm run dev) nếu đang chạy.");
  } catch (e) {
    console.error("✗ Cập nhật thất bại:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
