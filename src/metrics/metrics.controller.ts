import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { MetricsService } from "./metrics.service";
import { CreateMetricDto } from "./dto/create-metric.dto";
import { CreateMetricLogDto } from "./dto/create-metric-log.dto";
import { UpdateMetricDto } from "./dto/update-metric.dto";
import { MetricLogQueryDto } from "./dto/metric-log-query.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  TENANT_MEMBER_ROLES,
  TENANT_CONTRIBUTOR_ROLES,
} from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("Metrics")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("metrics")
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @ApiOperation({ summary: "Get all metrics with recent logs" })
  @ApiOkResponse({ description: "Metrics with latest log entries" })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30) // Cache for 30 seconds
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getAllMetrics(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationDto,
  ) {
    return this.metricsService.getAllMetrics(user.userId, user.tenantId, pagination);
  }

  @ApiOperation({ summary: "Create new metric" })
  @ApiCreatedResponse({ description: "Metric created" })
  @Post()
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async createMetric(
    @CurrentUser() user: UserContext,
    @Body() createMetricDto: CreateMetricDto,
  ) {
    return this.metricsService.createMetric(
      user.userId,
      user.tenantId,
      createMetricDto,
    );
  }

  @ApiOperation({ summary: "Create metric log entry" })
  @ApiCreatedResponse({ description: "Metric log appended" })
  @Post(":id/logs")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async createLog(
    @CurrentUser() user: UserContext,
    @Param("id") metricId: string,
    @Body() createMetricLogDto: CreateMetricLogDto,
  ) {
    return this.metricsService.createLog(
      user.userId,
      user.tenantId,
      metricId,
      createMetricLogDto,
    );
  }

  @ApiOperation({ summary: "Get metric summary for dashboard" })
  @ApiOkResponse({ description: "Aggregated metric summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.metricsService.getSummary(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get a single metric" })
  @ApiOkResponse({ description: "Metric details" })
  @Get(":id")
  @Roles(...TENANT_MEMBER_ROLES)
  async getMetric(@CurrentUser() user: UserContext, @Param("id") metricId: string) {
    return this.metricsService.getMetricById(
      user.userId,
      user.tenantId,
      metricId,
    );
  }

  @ApiOperation({ summary: "Update an existing metric" })
  @ApiOkResponse({ description: "Metric updated" })
  @Put(":id")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async updateMetric(
    @CurrentUser() user: UserContext,
    @Param("id") metricId: string,
    @Body() dto: UpdateMetricDto,
  ) {
    return this.metricsService.updateMetric(
      user.userId,
      user.tenantId,
      metricId,
      dto,
    );
  }

  @ApiOperation({ summary: "Delete a metric" })
  @ApiOkResponse({ description: "Metric deleted" })
  @Delete(":id")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async deleteMetric(@CurrentUser() user: UserContext, @Param("id") metricId: string) {
    return this.metricsService.deleteMetric(
      user.userId,
      user.tenantId,
      metricId,
    );
  }

  @ApiOperation({ summary: "List logs for a metric" })
  @ApiOkResponse({ description: "Metric logs" })
  @Get(":id/logs")
  @Roles(...TENANT_MEMBER_ROLES)
  async getLogs(
    @CurrentUser() user: UserContext,
    @Param("id") metricId: string,
    @Query() query: MetricLogQueryDto,
  ) {
    return this.metricsService.getMetricLogs(
      user.userId,
      user.tenantId,
      metricId,
      query,
    );
  }

  @ApiOperation({ summary: "Get metric trend data" })
  @ApiOkResponse({ description: "Metric trend data points" })
  @Get(":id/trend")
  @Roles(...TENANT_MEMBER_ROLES)
  async getTrend(@CurrentUser() user: UserContext, @Param("id") metricId: string) {
    return this.metricsService.getMetricTrend(
      user.userId,
      user.tenantId,
      metricId,
    );
  }
}
