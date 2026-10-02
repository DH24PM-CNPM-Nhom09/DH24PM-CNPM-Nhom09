import { Global, Injectable, Module } from "@nestjs/common";
import { PrismaService, type Tx } from "../prisma/prisma.service";
import { fail } from "./errors";

type ActorType = "CANDIDATE" | "STAFF" | "SYSTEM";

/**
 * M8 — Nhật ký & thông báo.
 * audit_log.actor_id và notification.recipient_id là khóa "đa hình" (không có
 * FK vật lý — quyết định hàng 2 của migration v3), nên service tự kiểm tra
 * người đó có tồn tại trước khi ghi, đúng như thiết kế GĐ3 yêu cầu.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertActor(db: Tx, type: ActorType, id: number | null) {
    if (type === "SYSTEM" || id === null) return;
    const exists =
      type === "STAFF"
        ? await db.staff_account.count({ where: { staff_account_id: BigInt(id) } })
        : await db.candidate.count({ where: { candidate_id: BigInt(id) } });
    if (!exists) fail("INVALID_ACTOR", `Không tìm thấy ${type === "STAFF" ? "cán bộ" : "thí sinh"} #${id} để ghi nhật ký.`);
  }

  async record(
    actor: { type: ActorType; id: number | null },
    action: string,
    entity: { table: string | null; id: number | bigint | null },
    detail: string,
    db: Tx = this.prisma,
  ) {
    await this.assertActor(db, actor.type, actor.id);
    await db.audit_log.create({
      data: {
        actor_type: actor.type,
        actor_id: actor.id === null ? null : BigInt(actor.id),
        action,
        entity_table: entity.table,
        entity_id: entity.id === null ? null : BigInt(entity.id),
        detail,
      },
    });
  }

  /**
   * Gửi thông báo cho thí sinh: tạo bản ghi kênh SYSTEM (hiện trong cổng thí sinh)
   * và EMAIL (hàng đợi gửi mail — hiện chưa nối SMTP nên để PENDING).
   */
  async notifyCandidate(candidateId: number, title: string, content: string, db: Tx = this.prisma) {
    await this.assertActor(db, "CANDIDATE", candidateId);
    const now = new Date();
    await db.notification.createMany({
      data: [
        { recipient_type: "CANDIDATE", recipient_id: BigInt(candidateId), channel: "SYSTEM", title, content, status: "SENT", sent_at: now },
        { recipient_type: "CANDIDATE", recipient_id: BigInt(candidateId), channel: "EMAIL", title, content, status: "PENDING" },
      ],
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
