import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import {
  DOMAIN_EVENTS,
  ApplicationStatusChangedEvent,
  ApplicationSubmittedEvent,
  EnrollmentWithdrawnEvent,
  ResultPublishedEvent,
} from '../../common/events/domain-events';

/**
 * Lang nghe domain event tu cac module khac de tu dong ghi audit_log /
 * gui notification - tranh moi module phai tu goi lap lai logic nay.
 *
 * Diem tich hop quan trong: EnrollmentWithdrawnEvent (tu module
 * decision-enrollment) o day chi log/notify; viec goi
 * AdmissionResultService.promoteFromWaitlist(...) can duoc dang ky them 1
 * listener rieng trong module admission-result (tranh phu thuoc nguoc
 * notification-audit -> admission-result).
 */
@Injectable()
export class CrossModuleEventListener {
  constructor(private readonly auditLog: AuditLogService, private readonly notification: NotificationService) {}

  @OnEvent(DOMAIN_EVENTS.APPLICATION_SUBMITTED)
  async onApplicationSubmitted(event: ApplicationSubmittedEvent) {
    await this.auditLog.record('CANDIDATE', event.candidateAccountId, 'SUBMIT_APPLICATION', 'application');
    await this.notification.notify('CANDIDATE', event.candidateAccountId, 'EMAIL');
  }

  @OnEvent(DOMAIN_EVENTS.APPLICATION_STATUS_CHANGED)
  async onApplicationStatusChanged(event: ApplicationStatusChangedEvent) {
    await this.auditLog.record(
      'STAFF',
      event.changedByStaffId,
      `CHANGE_STATUS:${event.fromStatus}->${event.toStatus}`,
      'application',
    );
  }

  @OnEvent(DOMAIN_EVENTS.RESULT_PUBLISHED)
  async onResultPublished(event: ResultPublishedEvent) {
    await this.auditLog.record('SYSTEM', undefined, `PUBLISH_RESULT:${event.result}`, 'admission_result');
  }

  @OnEvent(DOMAIN_EVENTS.ENROLLMENT_WITHDRAWN)
  async onEnrollmentWithdrawn(event: EnrollmentWithdrawnEvent) {
    await this.auditLog.record('SYSTEM', undefined, 'ENROLLMENT_WITHDRAWN', 'enrollment_confirmation');
  }
}
