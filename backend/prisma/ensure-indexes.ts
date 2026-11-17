/* eslint-disable no-console */
// ============================================================================
// Bổ sung chỉ mục (index) còn thiếu cho CSDL ĐANG CÓ DỮ LIỆU — chạy được trên cả MySQL 8 (Aiven) lẫn MariaDB.
// Dùng chung cho npm run db:update và npm run start:hosted. Chỉ THÊM chỉ mục, không xóa / sửa dữ liệu.
// (MySQL 8 không có "CREATE INDEX IF NOT EXISTS" nên kiểm tra information_schema trước.)
// ============================================================================
import type { PrismaClient } from "@prisma/client";

type IndexDef = {
  table: string;
  name: string;
  columns: string;
  unique?: boolean;
  label: string;
  /** Câu SQL đếm dữ liệu trùng — có trùng thì KHÔNG tạo chỉ mục UNIQUE (báo để cán bộ xử lý tay) */
  duplicates?: string;
};

export const INDEXES: IndexDef[] = [
  {
    table: "enrollment_completion",
    name: "uq_completion_transfer_ref",
    columns: "transfer_ref",
    unique: true,
    label: "mã học viên (transfer_ref) không trùng",
    duplicates: "SELECT COUNT(*) AS n FROM (SELECT transfer_ref FROM enrollment_completion WHERE transfer_ref IS NOT NULL GROUP BY transfer_ref HAVING COUNT(*) > 1) d",
  },
  { table: "notification", name: "idx_notification_queue", columns: "status, channel, notification_id", label: "hàng đợi gửi email thông báo" },
];

export async function ensureIndexes(prisma: PrismaClient, log: (m: string) => void = console.log) {
  for (const ix of INDEXES) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
      ix.table,
      ix.name,
    );
    if (Number(n) > 0) continue;
    if (ix.duplicates) {
      const [{ n: dup }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(ix.duplicates);
      if (Number(dup) > 0) {
        log(`! Chưa tạo chỉ mục ${ix.name} (${ix.label}): đang có ${dup} giá trị bị trùng, cần sửa tay trước.`);
        continue;
      }
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${ix.table}\` ADD ${ix.unique ? "UNIQUE " : ""}INDEX \`${ix.name}\` (${ix.columns})`);
    log(`✓ Đã thêm chỉ mục ${ix.name} (${ix.label}).`);
  }
}
