import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { asStaff, CurrentUser, Public, RequirePermission, type AuthUser } from "../../common/auth";
import { str } from "../../common/util";
import { AnnouncementsService } from "./announcements.service";

type Q = Record<string, string | undefined>;

/** Công khai: ai cũng xem được (kể cả chưa đăng nhập) */
@Controller("public")
export class PublicController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Public()
  @Get("announcements")
  list(@Query() q: Q) {
    return this.svc.publicList(q);
  }

  @Public()
  @Get("announcements/:id")
  detail(@Param("id", ParseIntPipe) id: number) {
    return this.svc.publicDetail(id);
  }

  @Public()
  @Get("open-batches")
  openBatches() {
    return this.svc.openBatches();
  }
}

/** Cán bộ tuyển sinh soạn / đăng / gỡ thông báo */
@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @RequirePermission("announcement:manage")
  list(@Query() q: Q) {
    return this.svc.adminList(q);
  }

  @Post()
  @RequirePermission("announcement:manage")
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.svc.create(asStaff(user), body);
  }

  @Put(":id")
  @RequirePermission("announcement:manage")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.svc.update(asStaff(user), id, body);
  }

  @Patch(":id/status")
  @RequirePermission("announcement:manage")
  status(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.svc.setStatus(asStaff(user), id, str(body.status));
  }
}
