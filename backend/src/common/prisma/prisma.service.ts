import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService - client Prisma dung chung cho toan bo module.
 *
 * QUY UOC (theo migration_v3_GD3.sql - hang 2):
 * notification.recipient_id va audit_log.actor_id la khoa polymorphic,
 * KHONG co FK vat ly trong DB. Toan ven du lieu duoc kiem tra o tang service
 * (xem NotificationService / AuditLogService trong module notification-audit)
 * truoc khi insert, thay vi dua vao Prisma middleware toan cuc de tranh
 * chan nham cac bang khac.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
