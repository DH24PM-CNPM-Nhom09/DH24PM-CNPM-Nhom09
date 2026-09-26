import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AdmissionResultService } from './admission-result.service';
import { DOMAIN_EVENTS, EnrollmentWithdrawnEvent } from '../../common/events/domain-events';

/**
 * Diem tich hop M7 (decision-enrollment) -> M6 (admission-result):
 * khi co thi sinh huy nhap hoc, tu dong thang 1 thi sinh dau danh sach
 * du bi (xem tai lieu thiet ke GD3, muc 3.5 - sequence diagram).
 */
@Injectable()
export class WaitlistPromotionListener {
  constructor(private readonly admissionResultService: AdmissionResultService) {}

  @OnEvent(DOMAIN_EVENTS.ENROLLMENT_WITHDRAWN)
  async onEnrollmentWithdrawn(event: EnrollmentWithdrawnEvent) {
    await this.admissionResultService.promoteFromWaitlist(event.batchMajorId, 1);
  }
}
