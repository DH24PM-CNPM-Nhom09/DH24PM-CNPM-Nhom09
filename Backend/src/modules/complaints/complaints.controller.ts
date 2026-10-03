import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ComplaintsService } from './complaints.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class SubmitComplaintDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  applicationCode!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}

  /** POST /api/v1/complaints */
  @Post()
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitComplaintDto) {
    return this.service.submit(user, dto);
  }
}
