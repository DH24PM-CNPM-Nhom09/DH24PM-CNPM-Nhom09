import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { asCandidate, CandidateOnly, CurrentUser, type AuthUser } from "../../common/auth";
import { str } from "../../common/util";
import { ComplaintsService } from "../admin/complaints.service";
import { EnrollmentService } from "../admin/enrollment.service";
import { ScoringService } from "../admin/scoring.service";
import { SupervisorsService } from "../admin/supervisors.service";
import { ApplicationFlowService } from "./application-flow.service";
import { CandidateService, type UploadedFileLike } from "./candidate.service";

/** Các API phân hệ Thí sinh — đường dẫn khớp frontend/web/src/lib/api.ts */
@Controller()
@CandidateOnly()
export class CandidateController {
  constructor(
    private readonly svc: CandidateService,
    private readonly flow: ApplicationFlowService,
    private readonly supervisors: SupervisorsService,
    private readonly scoring: ScoringService,
    private readonly enrollment: EnrollmentService,
    private readonly complaints: ComplaintsService,
  ) {}

  /** Khiếu nại thí sinh đã gửi, kèm trạng thái và câu trả lời của Nhà trường */
  @Get("complaints/me")
  myComplaints(@CurrentUser() user: AuthUser) {
    const me = asCandidate(user);
    return me.candidateId ? this.complaints.mine(me.candidateId) : [];
  }

  private cid(user: AuthUser) {
    const me = asCandidate(user);
    if (!me.candidateId) return 0;
    return me.candidateId;
  }

  // ---------------------------------------------------- xét tuyển → trúng tuyển → nhập học
  /** Nộp đơn phúc khảo điểm xét tuyển (trong hạn, có lệ phí theo hồ sơ) */
  @Post("applications/me/appeal")
  @HttpCode(200)
  appeal(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.scoring.fileAppeal(this.cid(user), body);
  }

  @Post("applications/me/enrollment/confirm")
  @HttpCode(200)
  confirmEnrollment(@CurrentUser() user: AuthUser) {
    return this.enrollment.candidateRespond(this.cid(user), true, {});
  }

  @Post("applications/me/enrollment/decline")
  @HttpCode(200)
  declineEnrollment(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.enrollment.candidateRespond(this.cid(user), false, body);
  }

  /** Giảng viên hướng dẫn: trạng thái theo bậc (thạc sĩ / tiến sĩ) và lịch sử đề nghị */
  @Get("supervisors/me")
  supervisorsMine(@CurrentUser() user: AuthUser) {
    return this.supervisors.mine(asCandidate(user));
  }

  @Post("supervisors/me/request")
  @HttpCode(200)
  supervisorRequest(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.supervisors.request(asCandidate(user), body.lecturerId);
  }

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

  // ---------------------------------------------------- tạo / nộp hồ sơ (UC-DK-01..05)
  /** Toàn bộ hồ sơ hiện tại (kể cả bản nháp): đợt, ngành, đào tạo, minh chứng, lệ phí, lịch sử */
  @Get("applications/me/full")
  async full(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.json(await this.flow.full(asCandidate(user)));
  }

  @Get("applications/me/checklist")
  checklist(@CurrentUser() user: AuthUser) {
    return this.flow.checklist(asCandidate(user));
  }

  @Get("lecturers")
  lecturers() {
    return this.flow.lecturers();
  }

  @Post("applications/me/draft")
  @HttpCode(200)
  saveDraft(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.flow.saveDraft(asCandidate(user), body);
  }

  @Delete("applications/me/documents/:id")
  deleteDocument(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number) {
    return this.flow.deleteDocument(asCandidate(user), id);
  }

  @Put("applications/me/proposal")
  saveProposal(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.flow.saveProposal(asCandidate(user), body);
  }

  @Put("applications/me/language")
  saveLanguage(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.flow.saveLanguage(asCandidate(user), body);
  }

  @Post("applications/me/submit")
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.flow.submit(asCandidate(user), body);
  }

  @Post("applications/me/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser) {
    return this.flow.cancelDraft(asCandidate(user));
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
