import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DOMAIN_EVENTS,
  ApplicationStatusChangedEvent,
} from '../../common/events/domain-events';

/**
 * State machine cho application.review_status (xem tai lieu thiet ke GD3, muc 2.4).
 *
 *   DA_NOP -> DANG_THAM_DINH -> HOP_LE
 *                            -> TU_CHOI
 *                            -> YEU_CAU_BO_SUNG -> DANG_THAM_DINH
 *                                               -> TU_CHOI (qua han)
 *
 * MOI transition BAT BUOC di qua service nay (khong update truc tiep field
 * o noi khac) va LUON ghi 1 dong vao application_status_history.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DA_NOP: ['DANG_THAM_DINH'],
  DANG_THAM_DINH: ['YEU_CAU_BO_SUNG', 'HOP_LE', 'TU_CHOI'],
  YEU_CAU_BO_SUNG: ['DANG_THAM_DINH', 'TU_CHOI'],
  HOP_LE: [],
  TU_CHOI: [],
};

@Injectable()
export class ApplicationReviewService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  async transition(applicationId: bigint, toStatus: string, changedByStaffId: bigint, changedByType = 'STAFF') {
    const application = await this.prisma.application.findUniqueOrThrow({ where: { applicationId } });
    const fromStatus = application.reviewStatus;

    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Khong the chuyen trang thai tu '${fromStatus}' sang '${toStatus}'. Cac trang thai hop le: ${allowed.join(', ') || '(khong con trang thai ke tiep)'}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.application.update({ where: { applicationId }, data: { reviewStatus: toStatus } }),
      this.prisma.applicationStatusHistory.create({
        data: { applicationId, changedByStaffId, changedByType, },
      }),
    ]);

    this.events.emit(
      DOMAIN_EVENTS.APPLICATION_STATUS_CHANGED,
      new ApplicationStatusChangedEvent(applicationId, fromStatus, toStatus, changedByStaffId),
    );

    return { applicationId: applicationId.toString(), fromStatus, toStatus };
  }

  approve(applicationId: bigint, reviewerStaffId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.applicationReview.create({
        data: { applicationId, reviewerStaffId, reviewResult: 'HOP_LE' },
      });
      return this.transition(applicationId, 'HOP_LE', reviewerStaffId);
    });
  }

  reject(applicationId: bigint, reviewerStaffId: bigint, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.applicationReview.create({
        data: { applicationId, reviewerStaffId, reviewResult: `TU_CHOI: ${reason}` },
      });
      return this.transition(applicationId, 'TU_CHOI', reviewerStaffId);
    });
  }

  requestSupplement(applicationId: bigint, requestedByStaffId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.supplementRequest.create({
        data: { applicationId, requestedByStaffId, status: 'CHO_BO_SUNG' },
      });
      return this.transition(applicationId, 'YEU_CAU_BO_SUNG', requestedByStaffId);
    });
  }
}
