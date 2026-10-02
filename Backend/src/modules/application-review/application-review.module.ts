import { Module } from '@nestjs/common';
import { ApplicationReviewController } from './application-review.controller';
import { ApplicationReviewService } from './application-review.service';

@Module({
  controllers: [ApplicationReviewController],
  providers: [ApplicationReviewService],
  exports: [ApplicationReviewService],
})
export class ApplicationReviewModule {}
