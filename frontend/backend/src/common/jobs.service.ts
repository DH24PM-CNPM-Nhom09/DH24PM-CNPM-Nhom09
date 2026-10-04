import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";
import { ApplicationsService } from "../modules/admin/applications.service";
import { EnrollmentService } from "../modules/admin/enrollment.service";
import { ScoringService } from "../modules/admin/scoring.service";
import { id } from "./util";

/**
 * Tác vụ tự động chạy định kỳ (mặc định 15 phút/lần, đặt AUTO_JOB_MINUTES=0 để tắt):
 *  1. Hồ sơ quá hạn bổ sung → "Không đạt" (REJECT_EXPIRED), báo thí sinh.
 *  2. Thí sinh trúng tuyển quá hạn xác nhận nhập học → xem như từ chối, gọi dự bị.
 *  3. Đơn phúc khảo chưa nộp lệ phí khi đã hết hạn phúc khảo → đóng đơn, điểm giữ nguyên.
 * Người thực hiện ghi là SYSTEM trong nhật ký. Cán bộ vẫn có nút làm tay tương ứng.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Jobs");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly apps: ApplicationsService,
    private readonly enrollment: EnrollmentService,
    private readonly scoring: ScoringService,
  ) {}

  onModuleInit() {
    const minutes = Number(process.env.AUTO_JOB_MINUTES ?? 15);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      this.log.log("Tác vụ tự động đang tắt (AUTO_JOB_MINUTES=0).");
      return;
    }
    // Chạy lần đầu sau 1 phút để backend khởi động xong
    setTimeout(() => void this.runAll(), 60_000).unref();
    this.timer = setInterval(() => void this.runAll(), minutes * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll() {
    if (this.running) return { skipped: true };
    this.running = true;
    const out = { supplementsExpired: 0, enrollmentsExpired: 0, waitlistPromoted: 0, appealsClosed: 0 };
    try {
      out.supplementsExpired = await this.expireSupplements();
      const e = await this.enrollment.expireOverdue({ type: "SYSTEM", id: null }, null);
      out.enrollmentsExpired = e.expired;
      out.waitlistPromoted = e.promoted;
      out.appealsClosed = await this.closeUnpaidAppeals();
      if (out.supplementsExpired || out.enrollmentsExpired || out.appealsClosed)
        this.log.log(`Đã xử lý: ${out.supplementsExpired} hồ sơ quá hạn bổ sung, ${out.enrollmentsExpired} thí sinh quá hạn xác nhận nhập học (gọi ${out.waitlistPromoted} dự bị), ${out.appealsClosed} đơn phúc khảo chưa nộp phí.`);
    } catch (e) {
      this.log.error(`Tác vụ tự động lỗi: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
    return out;
  }

  private async expireSupplements() {
    const now = new Date();
    const rows = await this.prisma.application.findMany({
      where: { review_status: "NEEDS_SUPPLEMENT", is_cancelled: false, deleted_at: null, supplement_request: { some: { status: "PENDING", deadline: { lt: now } } } },
      select: { application_id: true, application_code: true, candidate_id: true },
    });
    let n = 0;
    for (const a of rows) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.apps.changeStatus(tx, id(a.application_id), "NEEDS_SUPPLEMENT", "REJECTED", { type: "SYSTEM" }, "Quá hạn bổ sung hồ sơ.");
          await tx.supplement_request.updateMany({ where: { application_id: a.application_id, status: "PENDING" }, data: { status: "EXPIRED" } });
          await tx.application_review.create({ data: { application_id: a.application_id, review_type: "AUTO_CHECK", review_result: "FAIL", note: "Quá hạn bổ sung hồ sơ." } });
          await this.audit.record({ type: "SYSTEM", id: null }, "APPLICATION_REJECT_EXPIRED", { table: "application", id: a.application_id }, `${a.application_code}: Chờ bổ sung → Không đạt (tự động, quá hạn bổ sung)`, tx);
          await this.audit.notifyCandidate(id(a.candidate_id), "Hồ sơ không đạt", `Hồ sơ ${a.application_code} không đạt do quá hạn bổ sung.`, tx);
        });
        n++;
      } catch {
        // Hồ sơ vừa được cán bộ xử lý -> bỏ qua
      }
    }
    return n;
  }

  private async closeUnpaidAppeals() {
    const rows = await this.prisma.appeal_request.findMany({
      where: { status: "CHO_NOP_PHI", application: { admission_batch_major: { appeal_deadline: { lt: new Date() } } } },
      select: { request_id: true },
    });
    let n = 0;
    for (const r of rows) {
      try {
        await this.scoring.closeUnpaid({ type: "SYSTEM", id: null }, id(r.request_id));
        n++;
      } catch {
        // đã được xử lý
      }
    }
    return n;
  }
}
