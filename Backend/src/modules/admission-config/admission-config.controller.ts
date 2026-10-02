import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AdmissionConfigService } from './admission-config.service';
import { CreateBatchMajorDto } from './dto/create-batch-major.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('admission-batches')
export class AdmissionConfigController {
  constructor(private readonly service: AdmissionConfigService) {}

  @Get()
  listOpenBatches() {
    return this.service.listOpenBatches();
  }

  @Post('batch-majors')
  @RequirePermission('admission-config:manage')
  createBatchMajor(@Body() dto: CreateBatchMajorDto) {
    return this.service.createBatchMajor(dto);
  }

  @Patch(':batchId/open')
  @RequirePermission('admission-config:manage')
  openBatch(@Param('batchId') batchId: string) {
    return this.service.openBatch(BigInt(batchId));
  }
}
