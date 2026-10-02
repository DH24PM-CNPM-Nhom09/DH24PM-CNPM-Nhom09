import { IsIn, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken: string;

  @IsIn(['STAFF', 'CANDIDATE'])
  accountType: 'STAFF' | 'CANDIDATE';
}
