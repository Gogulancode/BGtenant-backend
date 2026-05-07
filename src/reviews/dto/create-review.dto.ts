import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
} from "class-validator";
import { ReviewType } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewType })
  @IsEnum(ReviewType)
  type: ReviewType;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  mood?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class GetReviewsQueryDto {
  @ApiProperty({ enum: ReviewType, required: false })
  @IsOptional()
  @IsEnum(ReviewType)
  type?: ReviewType;
}
