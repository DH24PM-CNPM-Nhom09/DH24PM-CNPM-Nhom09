import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

type Db = PrismaService | Prisma.TransactionClient;

/** Tài khoản đăng ký mà không xác thực email quá số ngày này thì bị dọn (tác vụ định kỳ) */
export const PENDING_ACCOUNT_DAYS = 7;

/**
 * Số điện thoại đang nằm ở một tài khoản CHƯA xác thực email (hoặc đã xóa) mà không còn mã xác thực nào hiệu lực
 * thì giải phóng cho người khác dùng. Tránh trường hợp ai đó đăng ký trước bằng SĐT của mình rồi bỏ đó,
 * khiến mình bị báo "số điện thoại đã được dùng" mãi mãi.
 * Trả về true nếu số điện thoại đang trống (hoặc vừa được giải phóng) cho tài khoản `forAccountId`.
 */
export async function phoneAvailable(db: Db, phone: string, forAccountId?: bigint | null): Promise<boolean> {
  const owner = await db.candidate_account.findFirst({ where: { phone_number: phone } });
  if (!owner || (forAccountId != null && owner.account_id === forAccountId)) return true;
  if (!owner.deleted_at && owner.status !== "PENDING_VERIFY") return false;
  if (!owner.deleted_at) {
    const live = await db.otp_verification.count({
      where: { account_id: owner.account_id, purpose: "REGISTER", verified_at: null, expires_at: { gt: new Date() } },
    });
    if (live) return false;
  }
  await db.candidate_account.update({ where: { account_id: owner.account_id }, data: { phone_number: null } });
  return true;
}

/**
 * Dọn tài khoản đăng ký nhưng không xác thực email sau PENDING_ACCOUNT_DAYS ngày:
 * xóa mềm, trả lại email / SĐT / tên đăng nhập để chủ thật đăng ký được.
 */
export async function purgeStalePendingAccounts(db: PrismaService): Promise<number> {
  const before = new Date(Date.now() - PENDING_ACCOUNT_DAYS * 86_400_000);
  const rows = await db.candidate_account.findMany({
    where: { status: "PENDING_VERIFY", deleted_at: null, created_at: { lt: before } },
    select: { account_id: true },
    take: 500,
  });
  const now = new Date();
  for (const r of rows) {
    // Còn mã đang hiệu lực (vừa bấm gửi lại) thì để lần sau
    const live = await db.otp_verification.count({ where: { account_id: r.account_id, verified_at: null, expires_at: { gt: now } } });
    if (live) continue;
    await db.$transaction([
      db.candidate.updateMany({ where: { account_id: r.account_id }, data: { id_number: null, deleted_at: now } }),
      db.candidate_account.update({
        where: { account_id: r.account_id },
        data: { username: `pending-${r.account_id}-${now.getTime()}`, email: null, phone_number: null, password_hash: null, deleted_at: now },
      }),
    ]);
  }
  return rows.length;
}
