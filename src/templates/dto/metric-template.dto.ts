import { Transform } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsEnum,
  Length,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum TemplateFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
}

export class CreateMetricTemplateDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 80)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetValue?: number;

  @ApiProperty({ required: false, enum: TemplateFrequency })
  @IsOptional()
  @IsEnum(TemplateFrequency)
  frequency?: TemplateFrequency;
}

export class UpdateMetricTemplateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 80)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetValue?: number;

  @ApiProperty({ required: false, enum: TemplateFrequency })
  @IsOptional()
  @IsEnum(TemplateFrequency)
  frequency?: TemplateFrequency;
}
