import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class UpsertSalesPlanningDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  q1?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  q2?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  q3?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  q4?: number;
}

export class UpsertSalesTrackerDto {
  @ApiProperty()
  @IsString()
  month: string; // "2025-10"

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  target?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  achieved?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mtd?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ytd?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orders?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  asp?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expenses?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  profit?: number;
}

export class GetSalesPlanningQueryDto {
  @ApiProperty({ example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;
}

export class GetSalesTrackerQueryDto {
  @ApiProperty({ example: "2025-10" })
  @IsString()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month: string;
}

export class GetWeekTargetQueryDto {
  @ApiProperty({ example: 1, description: "Week number (1-52)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  week: number;
}

// Response DTOs for Sales Targets

export class MonthlyTargetDto {
  @ApiProperty({ example: 1 })
  month: number;

  @ApiProperty({ example: "January" })
  monthName: string;

  @ApiProperty({ example: 8.33 })
  contributionPercent: number;

  @ApiProperty({ example: 100000 })
  targetValue: number;

  @ApiProperty({ example: 5 })
  weeksInMonth: number;
}

export class WeeklyTargetDto {
  @ApiProperty({ example: 1 })
  weekNumber: number;

  @ApiProperty({ example: 1 })
  month: number;

  @ApiProperty({ example: "January" })
  monthName: string;

  @ApiProperty({ example: 1 })
  weekInMonth: number;

  @ApiProperty({ example: 20000 })
  weeklyTarget: number;

  @ApiProperty({ example: 20000 })
  cumulativeTarget: number;
}

export class CurrentPeriodTargetsDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 1 })
  currentMonth: number;

  @ApiProperty({ example: 1 })
  currentWeek: number;

  @ApiProperty({ example: 100000 })
  monthlyTarget: number;

  @ApiProperty({ example: 20000 })
  weeklyTarget: number;

  @ApiProperty({ example: 15000 })
  achievedThisMonth: number;

  @ApiProperty({ example: 5000 })
  achievedThisWeek: number;

  @ApiProperty({ example: 15 })
  monthlyAchievementPercent: number;

  @ApiProperty({ example: 25 })
  weeklyAchievementPercent: number;

  @ApiProperty({ example: 3 })
  daysRemainingInWeek: number;

  @ApiProperty({ example: 2 })
  weeksRemainingInMonth: number;
}

// ============================================
// WEEKLY SUMMARY TREND DTOs
// ============================================

export class GetWeeklySummaryQueryDto {
  @ApiPropertyOptional({ example: 2026, description: "Year (defaults to current year)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ example: 1, description: "Starting week number (1-52)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  fromWeek?: number;

  @ApiPropertyOptional({ example: 6, description: "Ending week number (1-52)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  toWeek?: number;
}

export class AchievementStageDto {
  @ApiProperty({ example: "Gold" })
  name: string;

  @ApiProperty({ example: 75 })
  minPercentage: number;

  @ApiProperty({ example: 100 })
  maxPercentage: number;

  @ApiPropertyOptional({ example: "#FFD700" })
  color?: string;
}

export class WeeklySummaryItemDto {
  @ApiProperty({ example: 1 })
  week: number;

  @ApiProperty({ example: 20000 })
  target: number;

  @ApiProperty({ example: 15000 })
  achieved: number;

  @ApiProperty({ example: 75 })
  achievementPercent: number;

  @ApiPropertyOptional({ type: AchievementStageDto, nullable: true })
  stage?: AchievementStageDto | null;
}

export class WeeklySummaryResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 1 })
  fromWeek: number;

  @ApiProperty({ example: 6 })
  toWeek: number;

  @ApiProperty({ type: [WeeklySummaryItemDto] })
  items: WeeklySummaryItemDto[];
}

// ============================================
// WEEKLY SALES ENTRY DTOs
// ============================================

export class CreateWeeklySalesEntryDto {
  @ApiProperty({ example: 2026, description: "Year" })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ example: 2, description: "Week number (1-52)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  week: number;

  @ApiProperty({ example: 150000, description: "Amount achieved this week" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  achieved: number;

  @ApiPropertyOptional({ example: 5, description: "Number of orders/deals closed" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orders?: number;

  @ApiPropertyOptional({ example: "Closed ABC Corp deal", description: "Optional notes" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWeeklySalesEntryDto {
  @ApiPropertyOptional({ example: 175000, description: "Updated amount achieved" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  achieved?: number;

  @ApiPropertyOptional({ example: 6, description: "Updated number of orders" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orders?: number;

  @ApiPropertyOptional({ example: "Added one more deal", description: "Updated notes" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetWeeklySalesEntryQueryDto {
  @ApiProperty({ example: 2026, description: "Year" })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiPropertyOptional({ example: 2, description: "Week number (1-52)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  week?: number;
}

export class WeeklySalesEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  week: number;

  @ApiProperty()
  achieved: number;

  @ApiPropertyOptional()
  orders?: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  target: number;

  @ApiProperty()
  achievementPercent: number;

  @ApiProperty()
  status: "exceeded" | "achieved" | "below";

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
