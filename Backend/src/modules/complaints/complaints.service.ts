import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /complaints — body: { type, applicationCode, content }
   */
  async submit(
    user: JwtPayload,
    payload: { type: string; applicationCode: string; content: string },
  ) {
    if (user.type !== 'CANDIDATE') {
      throw new ForbiddenException({
        error_code: 'FORBIDDEN',
        message: 'Chỉ thí sinh mới gửi khiếu nại',
      });
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { accountId: BigInt(user.id) },
    });
    if (!candidate) {
      throw new NotFoundException({
        error_code: 'CANDIDATE_NOT_FOUND',
        message: 'Không tìm thấy thí sinh',
      });
    }

    await this.prisma.complaint.create({
      data: {
        candidateId: candidate.candidateId,
        applicationCode: payload.applicationCode,
        type: payload.type,
        content: payload.content,
        status: 'PENDING',
      },
    });

    return { success: true };
  }
}
