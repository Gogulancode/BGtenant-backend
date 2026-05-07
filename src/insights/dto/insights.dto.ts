import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

// ============================================
// WEEKLY DIAGNOSTICS DTOs
// ============================================

export class WeeklyDiagnosticsQueryDto {
  @ApiPropertyOptional({
    description: "Year for the diagnostics (defaults to current year)",
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

export type DiagnosticType = "SALES" | "ACTIVITY" | "OUTCOME";
export type DiagnosticLevel = "SUCCESS" | "WARNING" | "CRITICAL";

export class DiagnosticItemDto {
  @ApiProperty({
    description: "Type of diagnostic (SALES, ACTIVITY, or OUTCOME)",
    enum: ["SALES", "ACTIVITY", "OUTCOME"],
    example: "SALES",
  })
  type: DiagnosticType;

  @ApiProperty({
    description: "Severity level (SUCCESS, WARNING, or CRITICAL)",
    enum: ["SUCCESS", "WARNING", "CRITICAL"],
    example: "WARNING",
  })
  level: DiagnosticLevel;

  @ApiProperty({
    description: "Human-readable diagnostic message",
    example: "Activity levels are healthy, but conversions are low. Review lead quality.",
  })
  message: string;
}

export class DiagnosticsSummaryDto {
  @ApiProperty({
    description: "Sales achievement percentage for the week",
    example: 75.5,
  })
  salesAchievementPercent: number;

  @ApiProperty({
    description: "Activity completion percentage for the week",
    example: 85.0,
  })
  activityCompletionPercent: number;

  @ApiProperty({
    description: "Outcome completion percentage for the week",
    example: 60.0,
  })
  outcomeCompletionPercent: number;

  @ApiProperty({
    description: "Momentum effect score (-10 to +10)",
    example: 2,
  })
  momentumEffect: number;
}

export class WeeklyDiagnosticsResponseDto {
  @ApiProperty({ description: "Year of the diagnostics", example: 2026 })
  year: number;

  @ApiProperty({ description: "Week number (1-52)", example: 1 })
  week: number;

  @ApiProperty({
    description: "Array of diagnostic messages based on rule engine",
    type: [DiagnosticItemDto],
  })
  diagnostics: DiagnosticItemDto[];

  @ApiProperty({
    description: "Summary of key performance metrics",
    type: DiagnosticsSummaryDto,
  })
  summary: DiagnosticsSummaryDto;
}
