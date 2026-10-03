import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBatchMajorDto } from './dto/create-batch-major.dto';

@Injectable()
export class AdmissionConfigService {
  constructor(private readonly prisma: PrismaService) {}

  createBatchMajor(dto: CreateBatchMajorDto) {
    return this.prisma.admissionBatchMajor.create({
      data: {
        batchId: BigInt(dto.batchId),
        majorId: BigInt(dto.majorId),
        quota: dto.quota,
        status: 'CHUA_MO',
      },
    });
  }

  listOpenBatches() {
    return this.prisma.admissionBatch.findMany({
      where: { status: 'OPEN', deletedAt: null }, // luon loc deletedAt (soft delete)
      include: { batchMajors: { include: { major: true } } },
    });
  }

  /**
   * Business rule: tong weight cua cac exam_subject thuoc cung batch_major
   * phai bang 1.0 (100%) truoc khi cho phep mo dot (chuyen status -> OPEN).
   */
  async openBatch(batchId: bigint) {
    const batchMajors = await this.prisma.admissionBatchMajor.findMany({
      where: { batchId },
      include: { examSubjects: true },
    });

    for (const bm of batchMajors) {
      const totalWeight = bm.examSubjects.reduce((sum, s) => sum + Number(s.weight), 0);
      if (Math.abs(totalWeight - 1) > 0.001) {
        throw new BadRequestException(
          `Nganh (batchMajorId=${bm.batchMajorId}) co tong trong so mon thi = ${totalWeight}, phai = 1.0 truoc khi mo dot`,
        );
      }
    }

    return this.prisma.admissionBatch.update({ where: { batchId }, data: { status: 'OPEN' } });
  }
}
