/* eslint-disable no-console */
// ============================================================================
// npm run db:update — cập nhật CSDL ĐANG CÓ DỮ LIỆU lên bản mới nhất. Chạy lại nhiều lần vẫn an toàn.
//   1. Chạy database/migration_v5 → v10 (chỉ THÊM cột / dòng cấu hình / giá trị cho phép)
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
    const migrations: [string, string][] = [
      ["migration_v5_announcement.sql", "migration v5 (thêm cột category, is_pinned, updated_at cho bảng announcement)"],
      ["migration_v6_staff_security.sql", "migration v6 (đổi mật khẩu bắt buộc, chống dò mật khẩu cho tài khoản cán bộ)"],
      ["migration_v7_payment_config.sql", "migration v7 (cấu hình lệ phí xét tuyển và tài khoản nhận chuyển khoản)"],
      ["migration_v8_real_notice.sql", "migration v8 (minh chứng, ngoại ngữ, các khoản lệ phí theo thông báo tuyển sinh thật)"],
      ["migration_v9_english_test.sql", "migration v9 (thi đánh giá năng lực tiếng Anh: buổi thi, số báo danh, kết quả)"],
      ["migration_v10_admission_results.sql", "migration v10 (công bố điểm, hạn phúc khảo, đơn phúc khảo, cấu hình xác nhận nhập học)"],
    ];
    for (const [name, label] of migrations) {
      for (const stmt of sqlStatements(path.join(__dirname, "..", "database", name))) await prisma.$executeRawUnsafe(stmt);
      console.log(`✓ Đã chạy ${label}.`);
    }

    const fixed = await prisma.$executeRawUnsafe("UPDATE candidate SET nationality = ? WHERE nationality = ?", "Việt Nam", "Viá»‡t Nam");
    console.log(fixed ? `✓ Đã sửa lỗi font quốc tịch cho ${fixed} thí sinh.` : "✓ Cột quốc tịch không có lỗi font.");

    const n = await seedAnnouncements(prisma);
    console.log(n ? `✓ Đã nạp ${n} thông báo mẫu (tuyển sinh, quy định, hướng dẫn).` : "✓ Bảng thông báo đã có dữ liệu, giữ nguyên.");
    console.log("\nXong phần CSDL. Lệnh sẽ tự chạy tiếp prisma generate; sau đó mở lại backend bằng npm run dev.");
  } catch (e) {
    console.error("✗ Cập nhật thất bại:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
