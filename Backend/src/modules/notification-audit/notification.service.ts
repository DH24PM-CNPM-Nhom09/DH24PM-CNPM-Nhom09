import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type RecipientType = 'CANDIDATE' | 'STAFF';

/**
 * NotificationService - giai quyet dung migration_v3_GD3.sql (hang 2):
 * notification.recipient_id la khoa polymorphic, KHONG co FK vat ly.
 * Toan ven du lieu duoc dam bao O DAY (tang ung dung) truoc khi insert,
 * thay vi dua vao FK/trigger trong DB.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(recipientType: RecipientType, recipientId: bigint, channel: string, _template?: string) {
    await this.assertRecipientExists(recipientType, recipientId);

    return this.prisma.notification.create({
      data: { recipientType, recipientId, channel, status: 'CHO_GUI' },
    });
  }

  async notifyMany(recipientType: RecipientType, recipientIds: bigint[], channel: string) {
    return Promise.all(recipientIds.map((id) => this.notify(recipientType, id, channel)));
  }

  private async assertRecipientExists(recipientType: RecipientType, recipientId: bigint) {
    const exists =
      recipientType === 'CANDIDATE'
        ? await this.prisma.candidateAccount.findUnique({ where: { accountId: recipientId } })
        : await this.prisma.staffAccount.findUnique({ where: { staffAccountId: recipientId } });

    if (!exists) {
      throw new BadRequestException(
        `Khong tim thay recipient (${recipientType}, id=${recipientId}) - vi pham rang buoc polymorphic o tang app`,
      );
    }
  }
}
