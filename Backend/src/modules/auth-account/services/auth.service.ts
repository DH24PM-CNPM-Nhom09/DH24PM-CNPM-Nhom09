import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OtpService } from './otp.service';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * POST /auth/google — body: { idToken }
   * Response Frontend: { accessToken: string }
   */
  async loginWithGoogle(dto: GoogleLoginDto) {
    const payload = await this.verifyGoogleIdToken(dto.idToken);
    const email = (payload as { email?: string }).email;
    if (!email) {
      throw new UnauthorizedException({
        error_code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google token không hợp lệ',
      });
    }

    const accountType = dto.accountType ?? 'CANDIDATE';

    if (accountType === 'STAFF') {
      const staff = await this.prisma.staffAccount.findUnique({
        where: { email },
        include: { staffRoles: { include: { role: true } } },
      });
      if (!staff) {
        throw new UnauthorizedException({
          error_code: 'STAFF_NOT_FOUND',
          message: 'Tài khoản cán bộ chưa tồn tại trong hệ thống',
        });
      }
      const roleCodes = staff.staffRoles.map((sr) => sr.role.roleCode);
      return this.issueJwt({
        id: staff.staffAccountId.toString(),
        type: 'STAFF',
        roleCodes,
      });
    }

    // CANDIDATE — auto-provision nếu chưa có (Google lần đầu)
    let account = await this.prisma.candidateAccount.findUnique({ where: { email } });
    if (!account) {
      const username = email.split('@')[0].slice(0, 40) + '_' + Date.now().toString(36).slice(-4);
      account = await this.prisma.candidateAccount.create({
        data: {
          username,
          email,
          phoneNumber: `g_${Date.now()}`, // placeholder unique; user cập nhật sau
          passwordHash: null,
          status: 'DANG_HOAT_DONG',
        },
      });
      await this.prisma.candidate.create({
        data: {
          accountId: account.accountId,
          fullName: (payload as { name?: string }).name ?? email,
        },
      });
    }

    return this.issueJwt({
      id: account.accountId.toString(),
      type: 'CANDIDATE',
      roleCodes: [],
    });
  }

  /**
   * POST /auth/forgot-password — body: { emailOrPhone }
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const account = await this.findAccountByEmailOrPhone(dto.emailOrPhone);
    // Không lộ thông tin tài khoản có tồn tại hay không
    if (!account) {
      return { sent: true };
    }

    const { plainOtp } = await this.otpService.generate(account.accountId, 'RESET_PASSWORD');
    // TODO: gửi email/SMS. Hiện OTP_DEV_LOG=true sẽ in ra console.
    void plainOtp;

    return { sent: true };
  }

  /**
   * POST /auth/reset-password — body: { emailOrPhone, otp, newPassword }
   */
  async resetPassword(dto: ResetPasswordDto) {
    const account = await this.findAccountByEmailOrPhone(dto.emailOrPhone);
    if (!account) {
      throw new BadRequestException({
        error_code: 'ACCOUNT_NOT_FOUND',
        message: 'Không tìm thấy tài khoản',
      });
    }

    await this.otpService.verify(account.accountId, 'RESET_PASSWORD', dto.otp);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.candidateAccount.update({
      where: { accountId: account.accountId },
      data: { passwordHash },
    });

    return { success: true };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async findAccountByEmailOrPhone(emailOrPhone: string) {
    const v = emailOrPhone.trim();
    return this.prisma.candidateAccount.findFirst({
      where: {
        OR: [{ email: v }, { phoneNumber: v }],
      },
    });
  }

  private async verifyGoogleIdToken(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload() ?? {};
    } catch {
      // Dev fallback: cho phép idToken dạng "dev:<email>" khi NODE_ENV=development
      if (process.env.NODE_ENV === 'development' && idToken.startsWith('dev:')) {
        return { email: idToken.slice(4), name: 'Dev User' };
      }
      throw new UnauthorizedException({
        error_code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google token không hợp lệ hoặc đã hết hạn',
      });
    }
  }

  private issueJwt(user: { id: string; type: 'STAFF' | 'CANDIDATE'; roleCodes: string[] }) {
    const accessToken = this.jwt.sign(user);
    return { accessToken };
  }
}
