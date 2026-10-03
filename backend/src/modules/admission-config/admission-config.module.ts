import { Module } from '@nestjs/common';
import { AdmissionConfigController } from './admission-config.controller';
import { AdmissionConfigService } from './admission-config.service';

@Module({
  controllers: [AdmissionConfigController],
  providers: [AdmissionConfigService],
  exports: [AdmissionConfigService],
})
export class AdmissionConfigModule {}
