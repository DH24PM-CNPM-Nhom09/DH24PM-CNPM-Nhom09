/**
 * Cac domain event ban qua @nestjs/event-emitter de module notification-audit
 * tu dong ghi audit_log / gui notification ma khong lam nghen luong nghiep vu
 * chinh (xem so do phu thuoc module trong tai lieu thiet ke GD3, muc 1.3).
 */

export const DOMAIN_EVENTS = {
  APPLICATION_SUBMITTED: 'application.submitted',
  APPLICATION_STATUS_CHANGED: 'application.status_changed',
  SCORE_CHANGED: 'score.changed',
  RESULT_PUBLISHED: 'result.published',
  ENROLLMENT_WITHDRAWN: 'enrollment.withdrawn',
} as const;

export class ApplicationSubmittedEvent {
  constructor(public readonly applicationId: bigint, public readonly candidateAccountId: bigint) {}
}

export class ApplicationStatusChangedEvent {
  constructor(
    public readonly applicationId: bigint,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly changedByStaffId?: bigint,
  ) {}
}

export class ScoreChangedEvent {
  constructor(public readonly applicationId: bigint, public readonly batchMajorId: bigint) {}
}

export class ResultPublishedEvent {
  constructor(public readonly applicationId: bigint, public readonly result: string) {}
}

export class EnrollmentWithdrawnEvent {
  constructor(public readonly applicationId: bigint, public readonly batchMajorId: bigint) {}
}
