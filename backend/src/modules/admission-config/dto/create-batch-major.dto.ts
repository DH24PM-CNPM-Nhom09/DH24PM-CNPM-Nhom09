import { IsNumber, IsNumberString, Min } from 'class-validator';

export class CreateBatchMajorDto {
  @IsNumberString()
  batchId: string;

  @IsNumberString()
  majorId: string;

  @IsNumber()
  @Min(1)
  quota: number;
}
