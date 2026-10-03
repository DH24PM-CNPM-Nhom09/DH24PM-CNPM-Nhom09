import { IsIn, IsNumberString, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  accountId: string;

  @IsNumberString()
  otpCode: string;

  @IsIn(['REGISTER', 'RESET_PASSWORD'])
  purpose: 'REGISTER' | 'RESET_PASSWORD';
}
