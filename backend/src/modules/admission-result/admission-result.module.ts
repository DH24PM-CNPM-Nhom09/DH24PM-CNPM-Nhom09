import { Module } from '@nestjs/common';
import { AdmissionResultController } from './admission-result.controller';
import { AdmissionResultService } from './admission-result.service';
import { WaitlistPromotionListener } from './waitlist-promotion.listener';

@Module({
  controllers: [AdmissionResultController],
  // WaitlistPromotionListener duoc khai bao O DAY (khong phai o AppModule hay
  // NotificationAuditModule) de tranh phu thuoc vong module - no chi can
  // AdmissionResultService, la thu da co san trong chinh module nay.
  providers: [AdmissionResultService, WaitlistPromotionListener],
  exports: [AdmissionResultService],
})
export class AdmissionResultModule {}
