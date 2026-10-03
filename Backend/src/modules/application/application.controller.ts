import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApplicationService } from './application.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('applications')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  /** GET /api/v1/applications/me */
  @Get('me')
  getMyApplication(@CurrentUser() user: JwtPayload) {
    return this.service.getMyApplication(user);
  }

  /** GET /api/v1/applications/me/documents */
  @Get('me/documents')
  getMyDocuments(@CurrentUser() user: JwtPayload) {
    return this.service.getMyDocuments(user);
  }

  /** GET /api/v1/applications/me/supervisor-request */
  @Get('me/supervisor-request')
  getMySupervisorRequest(@CurrentUser() user: JwtPayload) {
    return this.service.getMySupervisorRequest(user);
  }

  /**
   * POST /api/v1/applications/:id/documents
   * multipart: file + documentType
   */
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    return this.service.uploadDocument(user, BigInt(id), file, documentType);
  }
}
