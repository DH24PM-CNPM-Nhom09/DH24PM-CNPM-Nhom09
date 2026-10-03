import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuditLogService } from './audit-log.service';
import { CrossModuleEventListener } from './cross-module.listener';

/**
 * Module dung chung - ca 3 backend dev deu goi vao NotificationService /
 * AuditLogService thay vi tu viet rieng le o tung module (xem tai lieu
 * thiet ke GD3, muc 1.2).
 */
@Module({
  providers: [NotificationService, AuditLogService, CrossModuleEventListener],
  exports: [NotificationService, AuditLogService],
})
export class NotificationAuditModule {}
