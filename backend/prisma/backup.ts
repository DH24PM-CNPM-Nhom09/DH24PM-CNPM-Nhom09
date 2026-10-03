/* eslint-disable no-console */
// ============================================================================
// npm run db:backup — sao lưu CSDL + thư mục tệp minh chứng vào thư mục backups/
//   backups/admission_db_<ngày>_<giờ>.sql   (đủ bảng, dữ liệu, trigger, thủ tục)
//   backups/uploads_<ngày>_<giờ>/           (bản sao tệp thí sinh đã tải lên)
// Chỉ TẠO bản sao mới, không xóa bản cũ. Khôi phục:  mysql -u root admission_db < tệp.sql
// Tìm mysqldump theo thứ tự: biến MYSQLDUMP_PATH, XAMPP ở ổ C:/D:, rồi lệnh mysqldump trong PATH.
// ============================================================================
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Đọc file .env (không cần thư viện ngoài); biến đã có trong môi trường được giữ nguyên
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile))
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }

function findDump(): string {
  const candidates = [
    process.env.MYSQLDUMP_PATH,
    "C:\\xampp\\mysql\\bin\\mysqldump.exe",
    "D:\\xampp\\mysql\\bin\\mysqldump.exe",
    "E:\\xampp\\mysql\\bin\\mysqldump.exe",
  ].filter((x): x is string => !!x);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return process.platform === "win32" ? "mysqldump.exe" : "mysqldump";
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

(() => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ Chưa có DATABASE_URL trong file .env");
    process.exit(1);
  }
  const u = new URL(url);
  const db = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const outDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = stamp();
  const file = path.join(outDir, `${db}_${ts}.sql`);

  const args = [
    `--host=${u.hostname || "localhost"}`,
    `--port=${u.port || "3306"}`,
    "--protocol=TCP",
    `--user=${decodeURIComponent(u.username || "root")}`,
    "--default-character-set=utf8mb4",
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--databases",
    db,
    `--result-file=${file}`,
  ];
  // Mật khẩu truyền qua biến môi trường để không hiện trên danh sách tiến trình
  const env = { ...process.env, MYSQL_PWD: decodeURIComponent(u.password || "") };
  const dump = findDump();
  console.log(`• Sao lưu CSDL ${db} bằng ${dump} ...`);
  const r = spawnSync(dump, args, { env, encoding: "utf8" });
  if (r.error || r.status !== 0) {
    console.error(`✗ Sao lưu thất bại: ${r.error?.message ?? r.stderr}`);
    console.error("  Kiểm tra MySQL (XAMPP) đang chạy; nếu không tìm thấy mysqldump, đặt MYSQLDUMP_PATH trong .env, ví dụ D:\\xampp\\mysql\\bin\\mysqldump.exe");
    process.exit(1);
  }
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`✓ CSDL: ${path.relative(process.cwd(), file)} (${kb.toLocaleString("vi-VN")} KB)`);

  const uploads = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads");
  if (fs.existsSync(uploads)) {
    const dest = path.join(outDir, `uploads_${ts}`);
    fs.cpSync(uploads, dest, { recursive: true });
    const count = fs.readdirSync(dest, { recursive: true }).length;
    console.log(`✓ Tệp minh chứng: ${path.relative(process.cwd(), dest)} (${count} mục)`);
  } else {
    console.log("• Chưa có thư mục tệp minh chứng, bỏ qua.");
  }
  console.log("\nXong. Nên chép thư mục backups/ sang ổ khác hoặc lưu trữ đám mây định kỳ.");
})();
