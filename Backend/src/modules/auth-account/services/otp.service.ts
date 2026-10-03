import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(
    accountId: bigint,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): Promise<{ plainOtp: string; expiresAt: Date }> {
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS ?? 300);
    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const otpCodeHash = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpVerification.deleteMany({ where: { accountId, purpose } });
      await tx.otpVerification.create({
        data: { accountId, purpose, otpCodeHash, expiresAt },
      });
    });

    if (process.env.OTP_DEV_LOG === 'true') {
      this.logger.warn(`[DEV OTP] accountId=${accountId} purpose=${purpose} otp=${plainOtp}`);
    }

    return { plainOtp, expiresAt };
  }

  async verify(
    accountId: bigint,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
    plainOtp: string,
  ): Promise<true> {
    const otp = await this.prisma.otpVerification.findFirst({
      where: { accountId, purpose },
      orderBy: { otpId: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException({
        error_code: 'OTP_NOT_FOUND',
        message: 'Không tìm thấy OTP, vui lòng yêu cầu gửi lại',
      });
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        error_code: 'OTP_EXPIRED',
        message: 'OTP đã hết hạn, vui lòng yêu cầu gửi lại',
      });
    }

    const match = await bcrypt.compare(plainOtp, otp.otpCodeHash);
    if (!match) {
      throw new BadRequestException({
        error_code: 'OTP_INVALID',
        message: 'Mã OTP không đúng',
      });
    }

    await this.prisma.otpVerification.delete({ where: { otpId: otp.otpId } });
    return true;
  }
}
