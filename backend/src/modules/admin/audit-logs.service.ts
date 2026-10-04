import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { toInt } from "../../common/util";
import { PrismaService } from "../../prisma/prisma.service";
import { toAuditDto } from "./mappers";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: Record<string, string | undefined>) {
    const page = toInt(q.page, 1);
    const pageSize = Math.min(100, toInt(q.pageSize, 20));
    const where: Prisma.audit_logWhereInput = {};
    if (q.actorType && ["STAFF", "CANDIDATE", "SYSTEM"].includes(q.actorType)) where.actor_type = q.actorType;
    const text = (q.q ?? "").trim();
    if (text) where.OR = [{ action: { contains: text } }, { detail: { contains: text } }, { entity_table: { contains: text } }];
    // Sắp xếp theo created_at để dùng đúng chỉ mục idx_audit_created_at (migration v3, hàng 5)
    const [total, rows] = await Promise.all([
      this.prisma.audit_log.count({ where }),
      this.prisma.audit_log.findMany({ where, orderBy: [{ created_at: "desc" }, { log_id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);

    // Tên người thực hiện: actor_id không có FK (thiết kế đa hình) nên tra theo actor_type
    const staffIds = rows.filter((r) => r.actor_type === "STAFF" && r.actor_id).map((r) => r.actor_id!);
    const candIds = rows.filter((r) => r.actor_type === "CANDIDATE" && r.actor_id).map((r) => r.actor_id!);
    const [staff, cands] = await Promise.all([
      this.prisma.staff_account.findMany({ where: { staff_account_id: { in: staffIds } }, select: { staff_account_id: true, full_name: true } }),
      this.prisma.candidate.findMany({ where: { candidate_id: { in: candIds } }, select: { candidate_id: true, full_name: true } }),
    ]);
    const nameOf = (r: (typeof rows)[number]) => {
      if (r.actor_type === "SYSTEM") return "Hệ thống";
      if (r.actor_type === "STAFF") return staff.find((s) => s.staff_account_id === r.actor_id)?.full_name ?? `Cán bộ #${r.actor_id}`;
      return cands.find((c) => c.candidate_id === r.actor_id)?.full_name ?? `Thí sinh #${r.actor_id}`;
    };
    return { total, items: rows.map((r) => ({ ...toAuditDto(r), actorName: nameOf(r) })) };
  }
}
