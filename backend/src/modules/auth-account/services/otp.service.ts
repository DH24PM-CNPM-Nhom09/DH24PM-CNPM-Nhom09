import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * OtpService
 * Business rule: moi (accountId, purpose) chi duoc 1 OTP con hieu luc tai
 * 1 thoi diem - tao OTP moi phai vo hieu OTP cu cung accountId + purpose.
 *
 * LUU Y: bang otp_verification trong ERD tong hop moi chi liet ke
 * (otp_id, account_id, purpose, expires_at). Truoc khi code that, bo sung
 * cot luu ma OTP (vi du otp_code_hash) vao schema - can QA (Lam Hoai An)
 * xac nhan lai cot chinh xac trong admission_db_v3.sql.
 */
@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(accountId: bigint, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS ?? 300);

    return this.prisma.$transaction(async (tx) => {
      // Vo hieu moi OTP cu cung purpose truoc khi tao moi.
      await tx.otpVerification.deleteMany({ where: { accountId, purpose } });

      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      return tx.otpVerification.create({ data: { accountId, purpose, expiresAt } });
    });
  }

  async verify(accountId: bigint, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const otp = await this.prisma.otpVerification.findFirst({
      where: { accountId, purpose },
      orderBy: { otpId: 'desc' },
    });

    if (!otp) throw new BadRequestException('Khong tim thay OTP, vui long yeu cau gui lai');
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP da het han, vui long yeu cau gui lai');
    }

    await this.prisma.otpVerification.delete({ where: { otpId: otp.otpId } });
    return true;
  }
}
