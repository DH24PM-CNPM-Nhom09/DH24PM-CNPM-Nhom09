import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type ActorType = 'CANDIDATE' | 'STAFF' | 'SYSTEM';

/**
 * AuditLogService - tuong tu NotificationService, xu ly actor_id polymorphic
 * (migration_v3_GD3.sql - hang 2). Ghi log CHI qua service nay, khong insert
 * truc tiep vao bang audit_log o noi khac, de dam bao validate nhat quan.
 *
 * Moi truy van audit_log theo thoi gian PHAI dung created_at trong
 * WHERE/ORDER BY de tan dung idx_audit_created_at (migration v3 - hang 5).
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(actorType: ActorType, actorId: bigint | undefined, action: string, entityTable: string) {
    return this.prisma.auditLog.create({ data: { actorType, actorId, action, entityTable } });
  }

  findRecent(entityTable: string, fromDate: Date, toDate: Date) {
    return this.prisma.auditLog.findMany({
      where: { entityTable, createdAt: { gte: fromDate, lte: toDate } }, // dung created_at -> co index
      orderBy: { createdAt: 'desc' },
    });
  }
}
