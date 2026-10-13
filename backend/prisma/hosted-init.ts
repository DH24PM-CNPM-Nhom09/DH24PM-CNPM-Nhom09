/* eslint-disable no-console */
// ============================================================================
// npm run start:hosted — dùng khi chạy backend trên Render (hoặc máy chủ không có cửa sổ lệnh):
//   1. CSDL còn trống  -> tạo đủ bảng + dữ liệu cấu hình từ database/hosted/admission_db_mysql.sql
//      (chạy được trên MySQL 8 như Aiven và cả MariaDB; không cần trigger)
//   2. Chưa có tài khoản cán bộ nào -> tạo tài khoản quản trị (SEED_ADMIN_PASSWORD),
//      hoặc nạp bộ dữ liệu mẫu nếu SEED_DEMO=true (mật khẩu chung SEED_DEMO_PASSWORD)
//   3. Chạy backend (node dist/main.js — nằm ở lệnh npm phía sau)
// CSDL đã có dữ liệu thì chỉ bổ sung bảng còn thiếu (CREATE TABLE IF NOT EXISTS), KHÔNG xóa hay sửa gì.
// Tắt hẳn bước này: đặt DB_AUTO_INIT=false.
// ============================================================================
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { seedAnnouncements } from "./announcements-seed";
import { normalizeDatabaseUrl } from "./hosted-util";

const SQL_FILE = path.join(__dirname, "..", "database", "hosted", "admission_db_mysql.sql");

/** Tách câu lệnh: mỗi câu kết thúc bằng ";" ở cuối dòng (dữ liệu trong tệp không chứa xuống dòng thật) */
function statements(file: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!cur.length && (!line.trim() || line.trim().startsWith("--"))) continue;
    cur.push(line);
    if (/;\s*$/.test(line)) {
      out.push(cur.join("\n").trim().replace(/;\s*$/, ""));
      cur = [];
    }
  }
  return out.filter((s) => s && !/^(USE)\b/i.test(s));
}

function runSeed(demo: boolean) {
  const tsNode = require.resolve("ts-node/dist/bin.js");
  const args = [tsNode, "--transpile-only", path.join(__dirname, "seed.ts"), ...(demo ? ["--demo"] : [])];
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error("Tạo tài khoản / dữ liệu mẫu thất bại (xem dòng lỗi phía trên).");
}

(async () => {
  if (String(process.env.DB_AUTO_INIT ?? "true").toLowerCase() === "false") {
    console.log("• DB_AUTO_INIT=false: bỏ qua bước khởi tạo CSDL.");
    return;
  }
  normalizeDatabaseUrl(); // áp dụng cho cả lệnh seed chạy kèm (dùng chung process.env)
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("Chưa đặt DATABASE_URL.");
  // Một kết nối duy nhất để lệnh SET FOREIGN_KEY_CHECKS áp dụng cho mọi câu phía sau
  const prisma = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
  try {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('candidate', 'stored_file')",
    );
    if (Number(n) < 2) {
      const list = statements(SQL_FILE);
      console.log(`• Khởi tạo CSDL từ ${path.basename(SQL_FILE)} (${list.length} câu lệnh)…`);
      await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
      for (const s of list) await prisma.$executeRawUnsafe(s);
      await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
      console.log("✓ Đã tạo đủ bảng và dữ liệu cấu hình.");
    } else {
      console.log("✓ CSDL đã có bảng, giữ nguyên dữ liệu.");
    }

    if ((await prisma.staff_account.count()) === 0) {
      const demo = String(process.env.SEED_DEMO ?? "").toLowerCase() === "true";
      if (!demo && !process.env.SEED_ADMIN_PASSWORD?.trim())
        console.warn("! Chưa đặt SEED_ADMIN_PASSWORD — tài khoản quản trị sẽ dùng mật khẩu mặc định Admin@123, hãy đổi ngay sau khi đăng nhập.");
      await prisma.$disconnect();
      runSeed(demo);
      if (!demo) {
        const n2 = await seedAnnouncements(prisma);
        if (n2) console.log(`✓ Đã nạp ${n2} thông báo tuyển sinh mẫu.`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error("✗ Khởi tạo CSDL thất bại:", e instanceof Error ? e.message : e);
  process.exit(1);
});
