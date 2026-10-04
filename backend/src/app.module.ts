import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "./common/audit.service";
import { AuthGuard } from "./common/auth";
import { JobsService } from "./common/jobs.service";
import { SystemConfigModule } from "./common/config.service";
import { MailModule } from "./common/mail.service";
import { NotificationDispatcher } from "./common/notification-dispatcher";
import { OtpModule } from "./common/otp.service";
import { AdminAnnouncementsController, PublicController } from "./modules/announcements/announcements.controller";
import { AnnouncementsService } from "./modules/announcements/announcements.service";
import { AppealsController, ApplicationsController, ComplaintsController, JobsController, AuditLogsController, BatchesController, CandidateAccountsController, MajorsController, EnglishTestController, DecisionsController, ResultsController, ScoringController, StaffController, SupervisorsController } from "./modules/admin/admin.controller";
import { AppealsService } from "./modules/admin/appeals.service";
import { ApplicationsService } from "./modules/admin/applications.service";
import { AuditLogsService } from "./modules/admin/audit-logs.service";
import { BatchesService } from "./modules/admin/batches.service";
import { CandidateAccountsService } from "./modules/admin/candidates.service";
import { MajorsService } from "./modules/admin/majors.service";
import { ComplaintsService } from "./modules/admin/complaints.service";
import { EnglishTestService } from "./modules/admin/english-test.service";
import { EnrollmentService } from "./modules/admin/enrollment.service";
import { ResultsService } from "./modules/admin/results.service";
import { ScoringService } from "./modules/admin/scoring.service";
import { StaffService } from "./modules/admin/staff.service";
import { SupervisorsService } from "./modules/admin/supervisors.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { ApplicationFlowService } from "./modules/candidate/application-flow.service";
import { CandidateController } from "./modules/candidate/candidate.controller";
import { CandidateService } from "./modules/candidate/candidate.service";
import { HealthController } from "./modules/health/health.controller";
import { PrismaModule } from "./prisma/prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 16) throw new Error("JWT_SECRET chưa được cấu hình (cần ít nhất 16 ký tự) trong file .env");
        return { secret, signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "8h" } };
      },
    }),
    PrismaModule,
    AuditModule,
    SystemConfigModule,
    MailModule,
    OtpModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    ApplicationsController,
    BatchesController,
    AppealsController,
    StaffController,
    AuditLogsController,
    CandidateAccountsController,
    SupervisorsController,
    EnglishTestController,
    ScoringController,
    ResultsController,
    DecisionsController,
    ComplaintsController,
    JobsController,
    MajorsController,
    CandidateController,
    PublicController,
    AdminAnnouncementsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    ApplicationsService,
    BatchesService,
    AppealsService,
    StaffService,
    AuditLogsService,
    CandidateAccountsService,
    SupervisorsService,
    EnglishTestService,
    ScoringService,
    ResultsService,
    EnrollmentService,
    ComplaintsService,
    MajorsService,
    CandidateService,
    ApplicationFlowService,
    AnnouncementsService,
    NotificationDispatcher,
    JobsService,
  ],
})
export class AppModule {}
