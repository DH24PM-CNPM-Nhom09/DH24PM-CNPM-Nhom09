import type { PrismaService } from "../prisma/prisma.service";

/**
 * Bộ đếm lưu trong CSDL (bảng security_counter, migration v14): không mất khi backend ngủ / khởi động lại.
 * Dùng cho số lần nhập sai OTP và giới hạn số lần gọi API xác thực theo IP.
 * Tăng 1 và trả về số đếm hiện tại trong cửa sổ thời gian; hết cửa sổ thì đếm lại từ 1.
 */
export async function bumpCounter(prisma: PrismaService, key: string, windowMs: number): Promise<{ hits: number; resetAt: Date }> {
  const k = key.slice(0, 191);
  const resetAt = new Date(Date.now() + windowMs);
  // Một câu lệnh nguyên tử: chưa có -> tạo; hết hạn -> đếm lại; còn hạn -> +1
  await prisma.$executeRawUnsafe(
    `INSERT INTO security_counter (counter_key, hits, reset_at) VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE hits = IF(reset_at < UTC_TIMESTAMP(), 1, hits + 1), reset_at = IF(reset_at < UTC_TIMESTAMP(), ?, reset_at)`,
    k,
    resetAt,
    resetAt,
  );
  const row = await prisma.security_counter.findUnique({ where: { counter_key: k } });
  return { hits: row?.hits ?? 1, resetAt: row?.reset_at ?? resetAt };
}

export async function clearCounter(prisma: PrismaService, key: string) {
  await prisma.security_counter.deleteMany({ where: { counter_key: key.slice(0, 191) } });
}

/** Dọn các bộ đếm đã hết hạn (gọi trong tác vụ định kỳ) */
export async function purgeCounters(prisma: PrismaService) {
  const r = await prisma.security_counter.deleteMany({ where: { reset_at: { lt: new Date() } } });
  return r.count;
}
