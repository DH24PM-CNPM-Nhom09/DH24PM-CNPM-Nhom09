import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { AdmissionResultService } from './admission-result.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('admission-results')
export class AdmissionResultController {
  constructor(private readonly service: AdmissionResultService) {}

  @Post('batch-majors/:batchMajorId/build-ranking')
  @RequirePermission('admission-result:build-ranking')
  buildRanking(@Param('batchMajorId') batchMajorId: string) {
    return this.service.buildRanking(BigInt(batchMajorId));
  }

  @Post('batch-majors/:batchMajorId/apply-benchmark')
  @RequirePermission('admission-result:apply-benchmark')
  applyBenchmark(@Param('batchMajorId') batchMajorId: string) {
    return this.service.applyBenchmark(BigInt(batchMajorId));
  }

  @Patch(':applicationId/approve-level1')
  @RequirePermission('admission-result:approve-level1')
  approveLevel1(@Param('applicationId') applicationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approveLevel1(BigInt(applicationId), BigInt(user.id));
  }

  @Patch(':applicationId/approve-level2')
  @RequirePermission('admission-result:approve-level2')
  approveLevel2(@Param('applicationId') applicationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approveLevel2AndPublish(BigInt(applicationId), BigInt(user.id));
  }
}
