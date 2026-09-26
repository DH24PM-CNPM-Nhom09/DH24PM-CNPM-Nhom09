import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ExamService } from './exam.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('exam')
export class ExamController {
  constructor(private readonly service: ExamService) {}

  @Post('batches/:batchId/auto-assign')
  @RequirePermission('exam:manage')
  autoAssign(@Param('batchId') batchId: string) {
    return this.service.autoAssignRoom(BigInt(batchId));
  }

  @Post('scores')
  @RequirePermission('exam:enter-score')
  enterScore(
    @Body() body: { applicationId: string; subjectId: string; score: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.enterScore(BigInt(body.applicationId), BigInt(body.subjectId), BigInt(user.id), body.score);
  }

  @Patch('score-appeals/:scoreId/resolve')
  @RequirePermission('exam:score-appeal')
  resolveAppeal(@Param('scoreId') scoreId: string, @Body('newScore') newScore: number) {
    return this.service.resolveAppeal(BigInt(scoreId), newScore);
  }
}
