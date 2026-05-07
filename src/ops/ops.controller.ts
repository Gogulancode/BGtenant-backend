import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from "@nestjs/swagger";
import { OpsService } from "./ops.service";
import { Public } from "../common/decorators/public.decorator";
import { UseGuards } from "@nestjs/common";
import { OpsAuthGuard } from "./guards/ops-auth.guard";
import {
  AuditLogResponseDto,
  InsightsTelemetryDashboardDto,
  RateLimitOverviewDto,
  TelemetryOverviewDto,
} from "./dto/ops.dto";
import { AuditLogQueryDto, RateLimitQueryDto } from "./dto/ops-query.dto";

@ApiTags("Ops")
@ApiBearerAuth("ops-service")
@UseGuards(OpsAuthGuard)
@Controller("ops")
export class OpsController {
  constructor(private opsService: OpsService) {}

  @Public() // Health check should be public
  @ApiOperation({ summary: "Get system health status (public endpoint)" })
  @Get("health")
  async getHealth() {
    return this.opsService.getSystemHealth();
  }

  @ApiOperation({ summary: "Get runtime environment snapshot" })
  @Get("environment")
  async getEnvironment() {
    return this.opsService.getEnvironmentInfo();
  }

  @ApiOperation({ summary: "Get telemetry overview for background jobs" })
  @ApiOkResponse({ type: TelemetryOverviewDto })
  @Get("telemetry")
  async getTelemetry(): Promise<TelemetryOverviewDto> {
    return this.opsService.getTelemetryOverview();
  }

  @ApiOperation({ summary: "Get insights telemetry dashboard" })
  @ApiOkResponse({ type: InsightsTelemetryDashboardDto })
  @Get("insights-telemetry")
  async getInsightsTelemetry(): Promise<InsightsTelemetryDashboardDto> {
    return this.opsService.getInsightsTelemetryDashboard();
  }

  @ApiOperation({ summary: "Get tenant-aware rate limit overview" })
  @ApiOkResponse({ type: RateLimitOverviewDto })
  @Get("rate-limits")
  async getRateLimits(
    @Query() query: RateLimitQueryDto,
  ): Promise<RateLimitOverviewDto> {
    const windowMinutes = this.clamp(query.windowMinutes ?? 60, 5, 240);
    return this.opsService.getRateLimitOverview(windowMinutes);
  }

  @ApiOperation({ summary: "Get recent structured audit logs" })
  @ApiOkResponse({ type: AuditLogResponseDto })
  @Get("audit-logs")
  async getAuditLogs(
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogResponseDto> {
    return this.opsService.getRecentAuditLogs(query);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}
