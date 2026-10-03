import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApplicationReviewService } from './application-review.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('applications')
export class ApplicationReviewController {
  constructor(private readonly service: ApplicationReviewService) {}

  @Patch(':id/approve')
  @RequirePermission('application:review')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(BigInt(id), BigInt(user.id));
  }

  @Patch(':id/reject')
  @RequirePermission('application:review')
  reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reject(BigInt(id), BigInt(user.id), reason);
  }

  @Patch(':id/request-supplement')
  @RequirePermission('application:supplement-request')
  requestSupplement(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.requestSupplement(BigInt(id), BigInt(user.id));
  }
}
