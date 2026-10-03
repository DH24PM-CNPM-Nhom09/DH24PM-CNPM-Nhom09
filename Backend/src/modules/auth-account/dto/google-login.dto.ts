import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  /** STAFF | CANDIDATE — mặc định CANDIDATE cho cổng thí sinh */
  @IsOptional()
  @IsString()
  accountType?: 'STAFF' | 'CANDIDATE';
}
