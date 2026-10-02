import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { asCandidate, CandidateOnly, CurrentUser, type AuthUser } from "../../common/auth";
import { str } from "../../common/util";
import { CandidateService, type UploadedFileLike } from "./candidate.service";

/** Các API phân hệ Thí sinh — đường dẫn khớp frontend/web/src/lib/api.ts */
@Controller()
@CandidateOnly()
export class CandidateController {
  constructor(private readonly svc: CandidateService) {}

  @Get("candidates/me")
  profile(@CurrentUser() user: AuthUser) {
    return this.svc.profile(asCandidate(user));
  }

  @Patch("candidates/me")
  update(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.svc.updateProfile(asCandidate(user), body);
  }

  // Trả JSON "null" khi chưa có hồ sơ (frontend gọi res.json() nên không được trả body rỗng)
  @Get("applications/me")
  async application(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.json(await this.svc.myApplication(asCandidate(user)));
  }

  @Get("applications/me/documents")
  documents(@CurrentUser() user: AuthUser) {
    return this.svc.myDocuments(asCandidate(user));
  }

  @Post("applications/me/supplement")
  @HttpCode(200)
  supplement(@CurrentUser() user: AuthUser) {
    return this.svc.submitSupplement(asCandidate(user));
  }

  @Get("applications/me/supervisor-request")
  async supervisor(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.json(await this.svc.supervisorRequest(asCandidate(user)));
  }

  @Post("applications/:id/documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 + 1024, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.upload(asCandidate(user), id, str(body.documentType), file);
  }

  @Post("complaints")
  complaint(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.svc.complaint(asCandidate(user), body);
  }

  @Get("notifications/me")
  notifications(@CurrentUser() user: AuthUser) {
    return this.svc.notifications(asCandidate(user));
  }

  @Patch("notifications/me/read-all")
  readAll(@CurrentUser() user: AuthUser) {
    return this.svc.markRead(asCandidate(user), null);
  }

  @Patch("notifications/:id/read")
  read(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.svc.markRead(asCandidate(user), id);
  }
}
