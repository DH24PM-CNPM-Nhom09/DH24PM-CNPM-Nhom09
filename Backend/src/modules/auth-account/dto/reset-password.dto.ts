import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
