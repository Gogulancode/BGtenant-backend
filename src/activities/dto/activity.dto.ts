import {
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Transform } from "class-transformer";

export class ActivityQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by category (Leads, Sales, Operations, etc.)",
    example: "Sales",
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ["Active", "Completed", "Cancelled"],
    example: "Active",
  })
  @IsOptional()
  @IsString()
  @IsIn(["Active", "Completed", "Cancelled"])
  status?: string;

  @ApiPropertyOptional({
    description: "Filter by priority",
    enum: ["Low", "Medium", "High"],
    example: "High",
  })
  @IsOptional()
  @IsString()
  @IsIn(["Low", "Medium", "High"])
  priority?: string;

  @ApiPropertyOptional({
    description: "Filter activities due on or after this date (ISO 8601)",
    example: "2025-01-01",
  })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({
    description: "Filter activities due on or before this date (ISO 8601)",
    example: "2025-12-31",
  })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;
}

export class CreateActivityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string; // Leads / Sales / Operations / etc.

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(["Low", "Medium", "High"])
  priority?: string; // Low / Medium / High

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false, default: "Active" })
  @IsOptional()
  @IsString()
  @IsIn(["Active", "Completed", "Cancelled"])
  status?: string; // Active / Completed / Cancelled
}

export class UpdateActivityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(["Low", "Medium", "High"])
  priority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(["Active", "Completed", "Cancelled"])
  status?: string;
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

export class WeeklySummaryItemDto {
  @ApiProperty({ description: "Activity category", example: "Sales" })
  category: string;

  @ApiProperty({ description: "Target count for the week", example: 10 })
  target: number;

  @ApiProperty({ description: "Actual count for the week", example: 7 })
  actual: number;

  @ApiProperty({ description: "Completion percentage", example: 70 })
  completionPercent: number;
}

export class WeeklySummaryResponseDto {
  @ApiProperty({ description: "Year of the summary", example: 2026 })
  year: number;

  @ApiProperty({ description: "Week number (1-52)", example: 1 })
  week: number;

  @ApiProperty({
    description: "Items per category with target vs actual",
    type: [WeeklySummaryItemDto],
  })
  items: WeeklySummaryItemDto[];

  @ApiProperty({
    description: "Overall completion percentage across all categories",
    example: 65.5,
  })
  overallCompletionPercent: number;
}
