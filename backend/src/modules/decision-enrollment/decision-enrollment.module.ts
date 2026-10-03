import { Module } from '@nestjs/common';
import { DecisionEnrollmentController } from './decision-enrollment.controller';
import { DecisionEnrollmentService } from './decision-enrollment.service';

@Module({
  controllers: [DecisionEnrollmentController],
  providers: [DecisionEnrollmentService],
  exports: [DecisionEnrollmentService],
})
export class DecisionEnrollmentModule {}
