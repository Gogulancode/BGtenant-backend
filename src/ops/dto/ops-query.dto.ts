import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class RateLimitQueryDto {
  @ApiPropertyOptional({
    description: "Rolling window length in minutes",
    default: 60,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  windowMinutes?: number;
}

export class AuditLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filter logs to a specific tenant" })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: "Filter logs by module" })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: "Filter logs by action" })
  @IsOptional()
  @IsString()
  action?: string;
}
