import { IsNumberString } from 'class-validator';

export class CreateApplicationDto {
  @IsNumberString()
  candidateId: string;

  @IsNumberString()
  batchMajorId: string;
}
