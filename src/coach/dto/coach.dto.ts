import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SalesProspectStatus } from "@prisma/client";

export enum CoachState {
  SETUP_INCOMPLETE = "SETUP_INCOMPLETE",
  CATCH_UP_REQUIRED = "CATCH_UP_REQUIRED",
  INACTIVE = "INACTIVE",
  ACHIEVED = "ACHIEVED",
  BEHIND = "BEHIND",
  ON_TRACK = "ON_TRACK",
  AHEAD = "AHEAD",
}

export enum CoachActionPriority {
  REQUIRED = "required",
  STRETCH = "stretch",
}

export enum CoachActionSource {
  SETUP = "setup",
  CATCH_UP = "catch_up",
  SALES = "sales",
  CRM = "crm",
  ACTIVITY = "activity",
  PROFILE = "profile",
}

export class CoachStatsDto {
  @ApiProperty({ example: 225000 })
  weeklyTarget: number;

  @ApiProperty({ example: 50000 })
  achievedSoFar: number;

  @ApiProperty({ example: 96429 })
  expectedByToday: number;

  @ApiProperty({ example: 175000 })
  remaining: number;

  @ApiProperty({ example: 4 })
  activityDone: number;

  @ApiProperty({ example: 7 })
  activityGoal: number;

  @ApiProperty({ example: 2 })
  followupsDue: number;
}

export class CoachActionDto {
  @ApiProperty({ example: "FOLLOW_UP_WARM_PROSPECTS" })
  type: string;

  @ApiProperty({ example: "Follow up with 2 warm prospects" })
  title: string;

  @ApiProperty({
    example: "You are behind pace and have warm prospects ready.",
  })
  reason: string;

  @ApiProperty({ enum: CoachActionPriority })
  priority: CoachActionPriority;

  @ApiProperty({ example: "Follow up" })
  cta: string;

  @ApiPropertyOptional({ example: "/sales/prospects" })
  route?: string;

  @ApiProperty({ enum: CoachActionSource })
  source: CoachActionSource;
}

export class CoachCelebrationDto {
  @ApiProperty({ example: "TARGET_ACHIEVED" })
  type: string;

  @ApiProperty({ example: "Weekly target achieved. Strong work." })
  message: string;
}

export class CoachGuidanceResponseDto {
  @ApiProperty({ enum: CoachState })
  state: CoachState;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: CoachStatsDto })
  stats: CoachStatsDto;

  @ApiProperty({ type: [CoachActionDto] })
  actions: CoachActionDto[];

  @ApiPropertyOptional({ type: CoachCelebrationDto })
  celebration?: CoachCelebrationDto;

  @ApiProperty()
  generatedAt: Date;
}

export class CoachCatchUpActivityDto {
  @ApiProperty({ example: "Followed up with Sarah Chen" })
  @IsString()
  title: string;

  @ApiProperty({ example: "Sales" })
  @IsString()
  category: string;

  @ApiProperty({ example: "2026-05-13" })
  @IsDateString()
  occurredOn: string;
}

export class CoachCatchUpProspectDto {
  @ApiProperty({ example: "Sarah Chen" })
  @IsString()
  name: string;

  @ApiProperty({ enum: SalesProspectStatus })
  @IsEnum(SalesProspectStatus)
  status: SalesProspectStatus;

  @ApiPropertyOptional({ example: "Send pricing proposal" })
  @IsOptional()
  @IsString()
  nextAction?: string;

  @ApiPropertyOptional({ example: "2026-05-15" })
  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;
}

export class CoachCatchUpDto {
  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salesRevenue?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  orderCount?: number;

  @ApiPropertyOptional({ type: [CoachCatchUpActivityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoachCatchUpActivityDto)
  activitiesCompleted?: CoachCatchUpActivityDto[];

  @ApiPropertyOptional({ type: [CoachCatchUpProspectDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoachCatchUpProspectDto)
  prospects?: CoachCatchUpProspectDto[];

  @ApiPropertyOptional({ example: "Closed two retained customer orders." })
  @IsOptional()
  @IsString()
  notes?: string;
}
