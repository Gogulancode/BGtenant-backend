import { ApiProperty } from "@nestjs/swagger";

class TelemetryTotalsDto {
  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;
}

export class JobTelemetryDto {
  @ApiProperty()
  job!: string;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty({ required: false })
  lastSuccessAt?: string;

  @ApiProperty({ required: false })
  lastFailureAt?: string;

  @ApiProperty({ required: false, type: Object })
  lastMetadata?: Record<string, unknown>;

  @ApiProperty({ required: false })
  lastError?: string;
}

export class TelemetryOverviewDto {
  @ApiProperty({ type: TelemetryTotalsDto })
  totals!: TelemetryTotalsDto;

  @ApiProperty({ type: JobTelemetryDto, isArray: true })
  jobs!: JobTelemetryDto[];
}

class InsightsSummaryDto {
  @ApiProperty()
  totalInsights!: number;

  @ApiProperty()
  avgMomentum!: number;

  @ApiProperty({ required: false })
  lastRefreshAt?: string;

  @ApiProperty({ required: false })
  lastTelemetryError?: string;
}

export class FlagDistributionDto {
  @ApiProperty()
  flag!: string;

  @ApiProperty()
  count!: number;
}

export class TopTenantMomentumDto {
  @ApiProperty({ required: false })
  tenantId?: string;

  @ApiProperty()
  tenantName!: string;

  @ApiProperty()
  avgMomentum!: number;

  @ApiProperty()
  usersTracked!: number;
}

export class InsightsTelemetryDashboardDto {
  @ApiProperty({ type: InsightsSummaryDto })
  summary!: InsightsSummaryDto;

  @ApiProperty({ type: FlagDistributionDto, isArray: true })
  flagDistribution!: FlagDistributionDto[];

  @ApiProperty({ type: TopTenantMomentumDto, isArray: true })
  topTenants!: TopTenantMomentumDto[];

  @ApiProperty({ type: JobTelemetryDto, required: false })
  telemetry?: JobTelemetryDto | null;
}

class RateLimitConfigDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  ttlMs!: number;
}

class RateLimitWindowDto {
  @ApiProperty()
  minutes!: number;

  @ApiProperty()
  since!: string;
}

export class RateLimitTenantDto {
  @ApiProperty({ required: false })
  tenantId?: string;

  @ApiProperty()
  tenantName!: string;

  @ApiProperty()
  requests!: number;
}

export class RateLimitModuleDto {
  @ApiProperty()
  module!: string;

  @ApiProperty()
  requests!: number;
}

export class RateLimitOverviewDto {
  @ApiProperty({ type: RateLimitConfigDto })
  config!: RateLimitConfigDto;

  @ApiProperty({ type: RateLimitWindowDto })
  window!: RateLimitWindowDto;

  @ApiProperty({ type: RateLimitTenantDto, isArray: true })
  topTenants!: RateLimitTenantDto[];

  @ApiProperty({ type: RateLimitModuleDto, isArray: true })
  moduleHotspots!: RateLimitModuleDto[];
}

export class AuditLogEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ required: false })
  tenantId?: string;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty()
  module!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ required: false })
  statusCode?: number;

  @ApiProperty({ required: false })
  responseTime?: number;

  @ApiProperty({ required: false })
  ipAddress?: string;

  @ApiProperty()
  createdAt!: string;
}

class PaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiProperty()
  hasPreviousPage!: boolean;
}

export class AuditLogResponseDto {
  @ApiProperty({ type: AuditLogEntryDto, isArray: true })
  data!: AuditLogEntryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
