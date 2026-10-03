import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { asStaff, CurrentUser, RequirePermission, type AuthUser } from "../../common/auth";
import { str } from "../../common/util";
import { AppealsService } from "./appeals.service";
import { ApplicationsService } from "./applications.service";
import { AuditLogsService } from "./audit-logs.service";
import { BatchesService } from "./batches.service";
import { CandidateAccountsService } from "./candidates.service";
import { MajorsService } from "./majors.service";
import { StaffService } from "./staff.service";
import { SupervisorsService } from "./supervisors.service";

type Q = Record<string, string | undefined>;
type B = Record<string, unknown>;

// ============================================================ M3/M4 — Hồ sơ & thẩm định
@Controller()
export class ApplicationsController {
  constructor(private readonly svc: ApplicationsService) {}

  @Get("admin/lookups")
  @RequirePermission("dashboard:view")
  lookups() {
    return this.svc.lookups();
  }

  @Get("admin/dashboard")
  @RequirePermission("dashboard:view")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.svc.dashboard(asStaff(user));
  }

  @Get("admin/applications")
  @RequirePermission("application:view")
  list(@Query() q: Q) {
    return this.svc.list(q);
  }

  @Get("admin/applications/:id")
  @RequirePermission("application:view")
  detail(@Param("id", ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Post("admin/applications/bulk-start-review")
  @HttpCode(200)
  @RequirePermission("application:review")
  bulk(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.bulkStart(asStaff(user), body.applicationIds);
  }

  @Patch("applications/:id/review")
  @RequirePermission("application:review")
  review(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.review(asStaff(user), id, str(body.action), {
      reason: body.reason as string | undefined,
      supplementContent: body.supplementContent as string | undefined,
      deadline: body.deadline as string | undefined,
    });
  }

  @Patch("admin/application-documents/:id/verify")
  @RequirePermission("application:review")
  verify(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.verifyDocument(asStaff(user), id, str(body.verifyStatus), body.reason as string | undefined);
  }

  @Patch("admin/applications/:id/payment/confirm")
  @RequirePermission("application:review")
  confirmPayment(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.confirmPayment(asStaff(user), id, body);
  }

  @Get("admin/payment-settings")
  @RequirePermission("application:view")
  paymentSettings() {
    return this.svc.paymentSettings();
  }

  @Put("admin/payment-settings")
  @RequirePermission("batch:manage")
  updatePaymentSettings(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.updatePaymentSettings(asStaff(user), body);
  }

  /** Xem tệp minh chứng (PDF/ảnh) — frontend tải bằng fetch có kèm token rồi hiển thị */
  @Get("admin/application-documents/:id/file")
  @RequirePermission("application:view")
  async file(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const { abs, fileName } = await this.svc.documentFile(id);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(abs);
  }
}

// ============================================================ M2 — Đợt tuyển sinh
@Controller()
export class BatchesController {
  constructor(private readonly svc: BatchesService) {}

  @Get("admission-batches")
  @RequirePermission("batch:view")
  list() {
    return this.svc.list();
  }

  @Post("admission-batches")
  @RequirePermission("batch:manage")
  create(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.create(asStaff(user), body);
  }

  @Get("admission-batches/:id")
  @RequirePermission("batch:view")
  detail(@Param("id", ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Patch("admission-batches/:id/status")
  @RequirePermission("batch:manage")
  status(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.changeStatus(asStaff(user), id, str(body.status));
  }

  @Post("admission-batches/:id/majors")
  @RequirePermission("batch:manage")
  addMajor(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.addMajor(asStaff(user), id, Number(body.majorId), Number(body.quota));
  }

  @Put("admission-batch-majors/:id")
  @RequirePermission("batch:manage")
  updateMajor(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.updateMajor(asStaff(user), id, body);
  }

  @Patch("admission-batch-majors/:id/approve")
  @RequirePermission("batch:approve")
  approve(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.svc.approveMajor(asStaff(user), id);
  }
}

// ============================================================ M5 — Phúc khảo
@Controller("score-appeals")
export class AppealsController {
  constructor(private readonly svc: AppealsService) {}

  @Get()
  @RequirePermission("appeal:view")
  list() {
    return this.svc.list();
  }

  @Post(":id/resolve")
  @HttpCode(200)
  @RequirePermission("appeal:resolve")
  resolve(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.resolve(asStaff(user), id, body);
  }
}

// ============================================================ M1 — Tài khoản cán bộ
@Controller("staff-accounts")
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermission("account:manage")
  list(@Query() q: Q) {
    return this.svc.list(q.includeDeleted === "true");
  }

  @Post()
  @RequirePermission("account:manage")
  create(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.create(asStaff(user), body);
  }

  @Put(":id/roles")
  @RequirePermission("account:manage")
  roles(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.updateRoles(asStaff(user), id, body);
  }

  @Patch(":id/status")
  @RequirePermission("account:manage")
  status(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.setStatus(asStaff(user), id, str(body.status));
  }

  @Patch(":id")
  @RequirePermission("account:manage")
  updateInfo(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.updateInfo(asStaff(user), id, body);
  }

  @Patch(":id/offboard")
  @RequirePermission("account:manage")
  offboard(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.offboard(asStaff(user), id, body);
  }

  @Patch(":id/restore")
  @RequirePermission("account:manage")
  restore(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.svc.restore(asStaff(user), id);
  }

  @Patch(":id/reset-password")
  @RequirePermission("account:manage")
  resetPassword(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.svc.resetPassword(asStaff(user), id);
  }
}

// ============================================================ M8 — Nhật ký
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly svc: AuditLogsService) {}

  @Get()
  @RequirePermission("audit:view")
  list(@Query() q: Q) {
    return this.svc.list(q);
  }
}

// ============================================================ Tài khoản thí sinh (phía cán bộ)
@Controller("admin/candidates")
export class CandidateAccountsController {
  constructor(private readonly svc: CandidateAccountsService) {}

  @Get()
  @RequirePermission("candidate:view")
  list(@Query() q: Q) {
    return this.svc.list(q);
  }

  /** Tệp CSV (mở bằng Excel) theo bộ lọc đang chọn */
  @Get("export")
  @RequirePermission("candidate:view")
  async export(@CurrentUser() user: AuthUser, @Query() q: Q, @Res() res: Response) {
    const csv = await this.svc.exportCsv(asStaff(user), q);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="danh-sach-thi-sinh.csv"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(csv);
  }

  @Get(":id")
  @RequirePermission("candidate:view")
  detail(@Param("id", ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Patch(":id/lock")
  @RequirePermission("candidate:manage")
  lock(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.lock(asStaff(user), id, body.reason);
  }

  @Patch(":id/unlock")
  @RequirePermission("candidate:manage")
  unlock(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.svc.unlock(asStaff(user), id);
  }
}

// ============================================================ Danh mục ngành đào tạo
@Controller("admin/majors")
export class MajorsController {
  constructor(private readonly svc: MajorsService) {}

  @Get()
  @RequirePermission("batch:view")
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermission("batch:manage")
  create(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.create(asStaff(user), body);
  }

  @Patch(":id")
  @RequirePermission("batch:manage")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.update(asStaff(user), id, body);
  }
}

// ============================================================ Giảng viên hướng dẫn (bậc tiến sĩ)
@Controller("admin")
export class SupervisorsController {
  constructor(private readonly svc: SupervisorsService) {}

  @Get("supervisor-requests")
  @RequirePermission("supervisor:manage")
  list(@Query() q: Q) {
    return this.svc.listRequests(q);
  }

  @Patch("supervisor-requests/:id/respond")
  @RequirePermission("supervisor:manage")
  respond(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.respond(asStaff(user), id, body);
  }

  @Get("lecturers")
  @RequirePermission("supervisor:manage")
  lecturers() {
    return this.svc.lecturers();
  }

  @Post("lecturers")
  @RequirePermission("supervisor:manage")
  createLecturer(@CurrentUser() user: AuthUser, @Body() body: B) {
    return this.svc.createLecturer(asStaff(user), body);
  }

  @Patch("lecturers/:id")
  @RequirePermission("supervisor:manage")
  updateLecturer(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: B) {
    return this.svc.updateLecturer(asStaff(user), id, body);
  }
}
