import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.service.createApplication(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(BigInt(id));
  }

  @Post(':id/documents')
  attachDocument(
    @Param('id') id: string,
    @Body() body: { documentType: string; fileHash: string; fileSizeKb: number },
  ) {
    return this.service.attachDocument(BigInt(id), body.documentType, body.fileHash, body.fileSizeKb);
  }
}
