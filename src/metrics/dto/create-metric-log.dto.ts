import { IsNumber, IsOptional, IsDateString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateMetricLogDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
