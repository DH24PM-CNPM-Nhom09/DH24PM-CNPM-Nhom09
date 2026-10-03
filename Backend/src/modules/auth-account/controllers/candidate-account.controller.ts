import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CandidateAccountService } from '../services/candidate-account.service';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Controller('candidates')
export class CandidateAccountController {
  constructor(private readonly candidateAccountService: CandidateAccountService) {}

  /** GET /api/v1/candidates/me */
  @Get('me')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.candidateAccountService.getMyProfile(user);
  }

  /** PATCH /api/v1/candidates/me */
  @Patch('me')
  updateMyProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.candidateAccountService.updateMyProfile(user, dto);
  }
}
