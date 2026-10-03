import { Body, Controller, Param, Post } from '@nestjs/common';
import { CandidateAccountService } from '../services/candidate-account.service';
import { RegisterCandidateDto } from '../dto/register-candidate.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('candidates')
export class CandidateAccountController {
  constructor(private readonly candidateAccountService: CandidateAccountService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterCandidateDto) {
    return this.candidateAccountService.register(dto);
  }

  @Public()
  @Post(':accountId/verify-otp')
  verify(@Param('accountId') accountId: string, @Body() dto: VerifyOtpDto) {
    return this.candidateAccountService.verifyRegistration(BigInt(accountId));
  }
}
