import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class CandidateAccountService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCandidate(user: JwtPayload) {
    if (user.type !== 'CANDIDATE') {
      throw new ForbiddenException({
        error_code: 'FORBIDDEN',
        message: 'Chỉ tài khoản thí sinh mới truy cập được',
      });
    }
    const accountId = BigInt(user.id);
    const candidate = await this.prisma.candidate.findUnique({
      where: { accountId },
      include: { account: true },
    });
    if (!candidate) {
      throw new NotFoundException({
        error_code: 'CANDIDATE_NOT_FOUND',
        message: 'Chưa có hồ sơ cá nhân, vui lòng cập nhật thông tin',
      });
    }
    return candidate;
  }

  /**
   * GET /candidates/me → Candidate (types.ts)
   */
  async getMyProfile(user: JwtPayload) {
    const c = await this.resolveCandidate(user);
    return {
      candidateId: Number(c.candidateId),
      fullName: c.fullName,
      dob: c.dob ? c.dob.toISOString().slice(0, 10) : '',
      gender: (c.gender as 'NAM' | 'NU' | 'KHAC' | null) ?? null,
      idNumber: c.idNumber,
      address: c.address,
      email: c.account.email,
      phoneNumber: c.account.phoneNumber?.startsWith('g_') ? null : c.account.phoneNumber,
    };
  }

  /**
   * PATCH /candidates/me
   */
  async updateMyProfile(user: JwtPayload, dto: UpdateProfileDto) {
    const c = await this.resolveCandidate(user);

    await this.prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { candidateId: c.candidateId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.dob !== undefined ? { dob: new Date(dto.dob) } : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.idNumber !== undefined ? { idNumber: dto.idNumber } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
        },
      });

      if (dto.phoneNumber !== undefined) {
        await tx.candidateAccount.update({
          where: { accountId: c.accountId },
          data: { phoneNumber: dto.phoneNumber },
        });
      }
    });

    return { success: true };
  }
}
