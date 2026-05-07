import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from "class-validator";
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from "@nestjs/swagger";
import { SalesProspectReason, SalesProspectStatus } from "@prisma/client";

export class SalesProspectQueryDto {
  @ApiPropertyOptional({ example: "2026-05" })
  @IsOptional()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @ApiPropertyOptional({ enum: SalesProspectStatus })
  @IsOptional()
  @IsEnum(SalesProspectStatus)
  status?: SalesProspectStatus;

  @ApiPropertyOptional({ enum: SalesProspectReason })
  @IsOptional()
  @IsEnum(SalesProspectReason)
  reason?: SalesProspectReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class SalesProspectSummaryQueryDto {
  @ApiPropertyOptional({ example: "2026-05" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

export class CreateSalesProspectDto {
  @ApiProperty({ example: "2026-05" })
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month: string;

  @ApiPropertyOptional({ example: "2026-05-06" })
  @IsOptional()
  @IsDateString()
  firstCallAt?: string;

  @ApiProperty({ example: "Acme Industries" })
  @IsString()
  @MinLength(2)
  prospectName: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional({ example: "Sales Excellence Workshop" })
  @IsOptional()
  @IsString()
  offeringType?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proposalValue?: number;

  @ApiPropertyOptional({ example: "Referral" })
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional({ example: "2026-05-10" })
  @IsOptional()
  @IsDateString()
  lastFollowUpAt?: string;

  @ApiPropertyOptional({ enum: SalesProspectStatus })
  @IsOptional()
  @IsEnum(SalesProspectStatus)
  status?: SalesProspectStatus;

  @ApiPropertyOptional({ enum: SalesProspectReason })
  @IsOptional()
  @IsEnum(SalesProspectReason)
  reason?: SalesProspectReason;

  @ApiPropertyOptional({ example: "Asked to follow up next week." })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateSalesProspectDto extends PartialType(
  CreateSalesProspectDto,
) {}
