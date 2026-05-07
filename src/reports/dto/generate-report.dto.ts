import { IsString, IsEnum, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum ReportRange {
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export class GenerateReportDto {
  @ApiProperty({ enum: ReportRange })
  @IsEnum(ReportRange)
  type: ReportRange;

  @ApiProperty({
    required: false,
    description: "Target user ID (defaults to current user)",
  })
  @IsOptional()
  @IsString()
  targetUserId?: string;
}
