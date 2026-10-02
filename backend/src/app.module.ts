import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "./common/audit.service";
import { AuthGuard } from "./common/auth";
import { SystemConfigModule } from "./common/config.service";
import { MailModule } from "./common/mail.service";
import { NotificationDispatcher } from "./common/notification-dispatcher";
import { OtpModule } from "./common/otp.service";
import { AdminAnnouncementsController, PublicController } from "./modules/announcements/announcements.controller";
import { AnnouncementsService } from "./modules/announcements/announcements.service";
import { AppealsController, ApplicationsController, AuditLogsController, BatchesController, StaffController } from "./modules/admin/admin.controller";
import { AppealsService } from "./modules/admin/appeals.service";
import { ApplicationsService } from "./modules/admin/applications.service";
import { AuditLogsService } from "./modules/admin/audit-logs.service";
import { BatchesService } from "./modules/admin/batches.service";
import { StaffService } from "./modules/admin/staff.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
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
    CandidateService,
    AnnouncementsService,
    NotificationDispatcher,
  ],
})
export class AppModule {}
