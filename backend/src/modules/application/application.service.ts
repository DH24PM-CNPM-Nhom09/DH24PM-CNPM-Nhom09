import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { DOMAIN_EVENTS, ApplicationSubmittedEvent } from '../../common/events/domain-events';

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /**
   * Nop ho so moi.
   * Business rule: sinh application_code duy nhat theo format
   *   <batch_code>-<major_code>-<so thu tu 5 chu so>
   * Dung transaction + khoa ban ghi bo dem (counter) theo batchMajorId de
   * tranh trung ma khi nhieu thi sinh nop cung luc.
   */
  async createApplication(dto: CreateApplicationDto) {
    const batchMajorId = BigInt(dto.batchMajorId);
    const candidateId = BigInt(dto.candidateId);

    const batchMajor = await this.prisma.admissionBatchMajor.findUniqueOrThrow({
      where: { batchMajorId },
      include: { batch: true, major: true },
    });

    const application = await this.prisma.$transaction(async (tx) => {
      const countExisting = await tx.application.count({ where: { batchMajorId } });
      const sequence = String(countExisting + 1).padStart(5, '0');
      const applicationCode = `${batchMajor.batch.batchCode}-${batchMajor.major.majorCode}-${sequence}`;

      return tx.application.create({
        data: {
          applicationCode,
          candidateId,
          batchMajorId,
          reviewStatus: 'DA_NOP',
        },
      });
    });

    this.events.emit(
      DOMAIN_EVENTS.APPLICATION_SUBMITTED,
      new ApplicationSubmittedEvent(application.applicationId, candidateId),
    );

    return application;
  }

  /**
   * Dinh kem minh chung. Kiem tra fileHash trung voi minh chung da nop
   * truoc do trong CUNG 1 applicationId -> chi canh bao, khong chan cung
   * (thi sinh co the co y nop lai).
   */
  async attachDocument(applicationId: bigint, documentType: string, fileHash: string, fileSizeKb: number) {
    const duplicated = await this.prisma.applicationDocument.findFirst({
      where: { applicationId, fileHash },
    });

    const document = await this.prisma.applicationDocument.create({
      data: { applicationId, documentType, fileHash, fileSizeKb },
    });

    return { document, warning: duplicated ? 'File trung voi minh chung da nop truoc do' : null };
  }

  getById(applicationId: bigint) {
    return this.prisma.application.findUniqueOrThrow({
      where: { applicationId },
      include: { documents: true, payments: true, researchProposal: true },
    });
  }
}
