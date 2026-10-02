import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';

/**
 * AuthService - dang nhap kep: mat khau (du phong) + Google (chinh).
 *
 * Business rule (theo migration_v3_GD3.sql - hang 1):
 * password_hash la NULLABLE. Neu tai khoan co password_hash = NULL nghia la
 * tai khoan CHI dang ky qua Google -> phai chan dang nhap bang mat khau va
 * tra loi ro rang, KHONG duoc tra loi chung chung "sai mat khau" (gay nham
 * lan cho nguoi dung).
 */
@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async loginStaff(dto: LoginDto) {
    const staff = await this.prisma.staffAccount.findUnique({
      where: { email: dto.email },
      include: { staffRoles: { include: { role: true } } },
    });
    if (!staff) throw new UnauthorizedException('Email hoac mat khau khong dung');

    if (!staff.passwordHash) {
      // Dung 1 loi rieng thay vi loi sai mat khau chung chung.
      throw new BadRequestException({
        code: 'ERR_PASSWORD_LOGIN_DISABLED',
        message: 'Tai khoan nay chi dang nhap bang Google. Vui long dung nut "Dang nhap Google".',
      });
    }

    const passwordMatches = await bcrypt.compare(dto.password, staff.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Email hoac mat khau khong dung');

    const roleCodes = staff.staffRoles.map((sr) => sr.role.roleCode);
    return this.issueJwt({ id: staff.staffAccountId.toString(), type: 'STAFF', roleCodes });
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const payload = await this.verifyGoogleIdToken(dto.idToken);
    const email = (payload as any).email;
    if (!email) throw new UnauthorizedException('Google token khong hop le');

    if (dto.accountType === 'STAFF') {
      const staff = await this.prisma.staffAccount.findUnique({
        where: { email },
        include: { staffRoles: { include: { role: true } } },
      });
      if (!staff) throw new UnauthorizedException('Tai khoan can bo chua ton tai trong he thong');
      const roleCodes = staff.staffRoles.map((sr) => sr.role.roleCode);
      return this.issueJwt({ id: staff.staffAccountId.toString(), type: 'STAFF', roleCodes });
    }

    const candidateAccount = await this.prisma.candidateAccount.findUnique({ where: { email } });
    if (!candidateAccount) throw new UnauthorizedException('Tai khoan chua dang ky, vui long dang ky truoc');
    return this.issueJwt({ id: candidateAccount.accountId.toString(), type: 'CANDIDATE', roleCodes: [] });
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async verifyGoogleIdToken(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload() ?? {};
  }

  private issueJwt(user: { id: string; type: 'STAFF' | 'CANDIDATE'; roleCodes: string[] }) {
    const accessToken = this.jwt.sign(user);
    return { accessToken, user };
  }
}
