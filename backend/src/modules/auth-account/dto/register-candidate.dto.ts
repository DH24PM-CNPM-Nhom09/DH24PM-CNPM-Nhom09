import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class RegisterCandidateDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber('VN')
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string; // co the bo trong neu se dang nhap bang Google sau
}
