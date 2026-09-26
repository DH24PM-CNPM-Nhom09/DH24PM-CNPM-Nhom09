import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RegisterCandidateDto } from '../dto/register-candidate.dto';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Injectable()
export class CandidateAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterCandidateDto) {
    const existed = await this.prisma.candidateAccount.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }, { phoneNumber: dto.phoneNumber }] },
    });
    if (existed) throw new ConflictException('Email, so dien thoai hoac ten dang nhap da duoc su dung');

    const passwordHash = dto.password ? await this.authService.hashPassword(dto.password) : null;

    const account = await this.prisma.candidateAccount.create({
      data: {
        username: dto.username,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        passwordHash,
        status: 'CHO_XAC_THUC',
      },
    });

    await this.otpService.generate(account.accountId, 'REGISTER');
    // TODO(module notification-audit): goi NotificationService.notify(...) de gui OTP qua email/SMS.

    return { accountId: account.accountId.toString(), status: account.status };
  }

  async verifyRegistration(accountId: bigint) {
    await this.otpService.verify(accountId, 'REGISTER');
    return this.prisma.candidateAccount.update({
      where: { accountId },
      data: { status: 'DANG_HOAT_DONG' },
    });
  }
}
