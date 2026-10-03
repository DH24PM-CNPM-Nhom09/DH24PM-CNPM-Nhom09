import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { DecisionEnrollmentService } from './decision-enrollment.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class DecisionEnrollmentController {
  constructor(private readonly service: DecisionEnrollmentService) {}

  @Post('decisions')
  @RequirePermission('decision:issue')
  issueDecision(
    @Body() body: { batchId: string; decisionNo: string; applicationIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.issueDecision(
      BigInt(body.batchId),
      body.decisionNo,
      BigInt(user.id),
      body.applicationIds.map(BigInt),
    );
  }

  @Post('enrollment/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirmEnrollment(BigInt(id));
  }

  @Post('enrollment/:id/withdraw')
  withdraw(@Param('id') id: string) {
    return this.service.withdraw(BigInt(id));
  }

  @Patch('enrollment/:id/verify-original-document')
  @RequirePermission('decision-enrollment:verify-original-document')
  verifyOriginalDocument(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.verifyOriginalDocument(BigInt(id), BigInt(user.id));
  }

  @Post('enrollment/:id/finalize')
  @RequirePermission('decision-enrollment:finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.finalizeEnrollment(BigInt(id), BigInt(user.id));
  }
}
