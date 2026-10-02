import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { HealthController } from './health/health.controller';
import { AuthAccountModule } from './modules/auth-account/auth-account.module';
import { AdmissionConfigModule } from './modules/admission-config/admission-config.module';
import { ApplicationModule } from './modules/application/application.module';
import { ApplicationReviewModule } from './modules/application-review/application-review.module';
import { ExamModule } from './modules/exam/exam.module';
import { AdmissionResultModule } from './modules/admission-result/admission-result.module';
import { DecisionEnrollmentModule } from './modules/decision-enrollment/decision-enrollment.module';
import { NotificationAuditModule } from './modules/notification-audit/notification-audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    // ---- 8 module nghiep vu (xem tai lieu thiet ke GD3, muc 1.1 - 1.2) ----
    AuthAccountModule, // M1 - Le Phuoc Hao
    AdmissionConfigModule, // M2 - Le Phuoc Hao
    ApplicationModule, // M3 - Pham Lu Gia Quan
    ApplicationReviewModule, // M4 - Pham Lu Gia Quan
    ExamModule, // M5 - Phan Minh Tri
    AdmissionResultModule, // M6 - Phan Minh Tri
    DecisionEnrollmentModule, // M7 - Phan Minh Tri
    NotificationAuditModule, // M8 - dung chung
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
