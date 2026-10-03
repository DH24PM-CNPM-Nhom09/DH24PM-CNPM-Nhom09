import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DOMAIN_EVENTS, EnrollmentWithdrawnEvent } from '../../common/events/domain-events';

@Injectable()
export class DecisionEnrollmentService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /**
   * Ban hanh quyet dinh trung tuyen.
   * Chi nhan application co admission_result.result = 'TRUNG_TUYEN' va
   * CHUA thuoc decision_application nao khac.
   */
  async issueDecision(batchId: bigint, decisionNo: string, signedByStaffId: bigint, applicationIds: bigint[]) {
    const eligible = await this.prisma.application.findMany({
      where: {
        applicationId: { in: applicationIds },
        admissionResult: { result: 'TRUNG_TUYEN' },
        decisionDetails: { none: {} },
      },
    });

    if (eligible.length !== applicationIds.length) {
      throw new BadRequestException(
        'Co ho so khong hop le: chua trung tuyen hoac da thuoc mot quyet dinh khac',
      );
    }

    return this.prisma.admissionDecision.create({
      data: {
        batchId,
        decisionNo,
        signedByStaffId,
        status: 'DA_BAN_HANH',
        details: { create: eligible.map((app) => ({ applicationId: app.applicationId })) },
      },
      include: { details: true },
    });
  }

  confirmEnrollment(applicationId: bigint) {
    return this.prisma.enrollmentConfirmation.upsert({
      where: { applicationId },
      create: { applicationId, status: 'DA_XAC_NHAN' },
      update: { status: 'DA_XAC_NHAN' },
    });
  }

  /**
   * Huy nhap hoc sau khi da xac nhan -> phai bao event de module
   * admission-result thang du bi (xem AdmissionResultListener).
   */
  async withdraw(applicationId: bigint) {
    const application = await this.prisma.application.findUniqueOrThrow({ where: { applicationId } });

    await this.prisma.enrollmentConfirmation.update({
      where: { applicationId },
      data: { status: 'DA_HUY' },
    });

    this.events.emit(
      DOMAIN_EVENTS.ENROLLMENT_WITHDRAWN,
      new EnrollmentWithdrawnEvent(applicationId, application.batchMajorId),
    );

    return { applicationId: applicationId.toString(), status: 'DA_HUY' };
  }

  verifyOriginalDocument(applicationId: bigint, verifiedByStaffId: bigint) {
    return this.prisma.originalDocumentSubmission.upsert({
      where: { applicationId },
      create: { applicationId, verifiedByStaffId, status: 'DA_XAC_MINH' },
      update: { verifiedByStaffId, status: 'DA_XAC_MINH' },
    });
  }

  /**
   * Chi cho hoan tat nhap hoc khi da xac minh ban chinh.
   */
  async finalizeEnrollment(applicationId: bigint, completedByStaffId: bigint) {
    const submission = await this.prisma.originalDocumentSubmission.findUnique({ where: { applicationId } });
    if (submission?.status !== 'DA_XAC_MINH') {
      throw new BadRequestException('Chua xac minh ban chinh, khong the hoan tat nhap hoc');
    }

    const transferRef = `TRF-${applicationId}-${Date.now()}`;
    return this.prisma.enrollmentCompletion.create({
      data: { applicationId, completedByStaffId, transferRef },
    });
  }
}
