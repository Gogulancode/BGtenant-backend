import { IsDateString, IsEnum, IsOptional, IsString, IsInt, Min, Max } from "class-validator";
import { OutcomeStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateOutcomeDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ enum: OutcomeStatus })
  @IsEnum(OutcomeStatus)
  status: OutcomeStatus;

  @ApiProperty()
  @IsDateString()
  weekStartDate: string;
}

export class UpdateOutcomeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ enum: OutcomeStatus, required: false })
  @IsOptional()
  @IsEnum(OutcomeStatus)
  status?: OutcomeStatus;
}

export class GetOutcomesQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  weekStart?: string;
}

// ============================================
// WEEKLY SUMMARY DTOs
// ============================================

export class WeeklySummaryQueryDto {
  @ApiPropertyOptional({
    description: "Year for the summary (defaults to current year)",
    example: 2026,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: "Week number (1-52, defaults to current week)",
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1, { message: "Week must be between 1 and 52" })
  @Max(52, { message: "Week must be between 1 and 52" })
  week?: number;
}

export class WeeklySummaryResponseDto {
  @ApiProperty({ description: "Year of the summary", example: 2026 })
  year: number;

  @ApiProperty({ description: "Week number (1-52)", example: 1 })
  week: number;

  @ApiProperty({ description: "Number of outcomes planned for the week", example: 5 })
  planned: number;

  @ApiProperty({ description: "Number of outcomes completed in the week", example: 3 })
  completed: number;

  @ApiProperty({ description: "Completion percentage", example: 60 })
  completionPercent: number;
}
