import {
  Controller,
  Get,
  Post,
  Body,
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
import { SalesService } from "./sales.service";
import { SalesTargetsService } from "./sales-targets.service";
import {
  UpsertSalesPlanningDto,
  UpsertSalesTrackerDto,
  GetSalesPlanningQueryDto,
  GetSalesTrackerQueryDto,
  GetWeekTargetQueryDto,
  GetWeeklySummaryQueryDto,
  MonthlyTargetDto,
  WeeklyTargetDto,
  CurrentPeriodTargetsDto,
  WeeklySummaryResponseDto,
  CreateWeeklySalesEntryDto,
  UpdateWeeklySalesEntryDto,
  GetWeeklySalesEntryQueryDto,
  WeeklySalesEntryResponseDto,
} from "./dto/sales.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  TENANT_LEADERSHIP_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("Sales")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sales")
export class SalesController {
  constructor(
    private salesService: SalesService,
    private salesTargetsService: SalesTargetsService,
  ) {}

  @ApiOperation({ summary: "Get sales planning for year" })
  @ApiOkResponse({ description: "Sales planning configuration" })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  @Get("planning")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSalesPlanning(
    @CurrentUser() user: UserContext,
    @Query() query: GetSalesPlanningQueryDto,
  ) {
    return this.salesService.getSalesPlanning(
      user.userId,
      user.tenantId,
      query.year,
    );
  }

  @ApiOperation({ summary: "Create or update sales planning" })
  @ApiCreatedResponse({ description: "Sales planning saved" })
  @Post("planning")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async upsertSalesPlanning(
    @CurrentUser() user: UserContext,
    @Body() dto: UpsertSalesPlanningDto,
  ) {
    return this.salesService.upsertSalesPlanning(
      user.userId,
      user.tenantId,
      dto,
    );
  }

  @ApiOperation({ summary: "Get sales tracker for month" })
  @ApiOkResponse({ description: "Monthly sales tracker" })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  @Get("tracker")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSalesTracker(
    @CurrentUser() user: UserContext,
    @Query() query: GetSalesTrackerQueryDto,
  ) {
    return this.salesService.getSalesTracker(
      user.userId,
      user.tenantId,
      query.month,
    );
  }

  @ApiOperation({ summary: "Create or update sales tracker" })
  @ApiCreatedResponse({ description: "Sales tracker saved" })
  @Post("tracker")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async upsertSalesTracker(
    @CurrentUser() user: UserContext,
    @Body() dto: UpsertSalesTrackerDto,
  ) {
    return this.salesService.upsertSalesTracker(
      user.userId,
      user.tenantId,
      dto,
    );
  }

  @ApiOperation({ summary: "Get sales dashboard summary" })
  @ApiOkResponse({ description: "Sales dashboard summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.salesService.getSummary(user.userId, user.tenantId);
  }

  // ============================================
  // SALES TARGETS ENDPOINTS
  // ============================================

  @ApiOperation({ summary: "Get current period targets with achievement data" })
  @ApiOkResponse({ description: "Current period sales targets", type: CurrentPeriodTargetsDto })
  @Get("targets")
  @Roles(...TENANT_MEMBER_ROLES)
  async getCurrentTargets(@CurrentUser() user: UserContext) {
    return this.salesTargetsService.getCurrentPeriodTargets(
      user.userId,
      user.tenantId,
    );
  }

  @ApiOperation({ summary: "Get all monthly targets for the year" })
  @ApiOkResponse({ description: "Monthly targets breakdown", type: [MonthlyTargetDto] })
  @Get("targets/monthly")
  @Roles(...TENANT_MEMBER_ROLES)
  async getMonthlyTargets(@CurrentUser() user: UserContext) {
    return this.salesTargetsService.getMonthlyTargets(user.tenantId);
  }

  @ApiOperation({ summary: "Get all 52 weekly targets for the year" })
  @ApiOkResponse({ description: "Weekly targets breakdown", type: [WeeklyTargetDto] })
  @Get("targets/weekly")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklyTargets(@CurrentUser() user: UserContext) {
    return this.salesTargetsService.getWeeklyTargets(user.tenantId);
  }

  @ApiOperation({ summary: "Get target for a specific week" })
  @ApiOkResponse({ description: "Weekly target for specified week", type: WeeklyTargetDto })
  @Get("targets/week")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeekTarget(
    @CurrentUser() user: UserContext,
    @Query() query: GetWeekTargetQueryDto,
  ) {
    return this.salesTargetsService.getWeeklyTargetForWeek(
      user.tenantId,
      query.week,
    );
  }

  @ApiOperation({ 
    summary: "Get weekly summary trend",
    description: "Returns weekly sales performance for a range of weeks (default: last 6 weeks including current)",
  })
  @ApiOkResponse({ 
    description: "Weekly summary trend with targets, achieved, and achievement stages",
    type: WeeklySummaryResponseDto,
  })
  @Get("weekly-summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklySummary(
    @CurrentUser() user: UserContext,
    @Query() query: GetWeeklySummaryQueryDto,
  ) {
    return this.salesTargetsService.getWeeklySummary(
      user.tenantId,
      query.year,
      query.fromWeek,
      query.toWeek,
    );
  }

  @ApiOperation({ summary: "Get all sales trackers with pagination" })
  @ApiOkResponse({ description: "Paginated list of sales trackers" })
  @Get("trackers")
  @Roles(...TENANT_MEMBER_ROLES)
  async getAllSalesTrackers(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationDto,
  ) {
    return this.salesService.getAllSalesTrackers(
      user.userId,
      user.tenantId,
      pagination,
    );
  }

  // ============================================
  // WEEKLY SALES ENTRY ENDPOINTS
  // ============================================

  @ApiOperation({ summary: "Log or update weekly sales achievement" })
  @ApiCreatedResponse({ description: "Weekly sales entry saved", type: WeeklySalesEntryResponseDto })
  @Post("weekly-entry")
  @Roles(...TENANT_MEMBER_ROLES)
  async createWeeklySalesEntry(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateWeeklySalesEntryDto,
  ) {
    return this.salesService.createWeeklySalesEntry(
      user.userId,
      user.tenantId,
      dto,
    );
  }

  @ApiOperation({ summary: "Get weekly sales entry for a specific week" })
  @ApiOkResponse({ description: "Weekly sales entry with target comparison", type: WeeklySalesEntryResponseDto })
  @Get("weekly-entry")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklySalesEntry(
    @CurrentUser() user: UserContext,
    @Query() query: GetWeeklySalesEntryQueryDto,
  ) {
    if (query.week) {
      return this.salesService.getWeeklySalesEntry(
        user.userId,
        user.tenantId,
        query.year,
        query.week,
      );
    }
    // Return all entries for the year
    return this.salesService.getWeeklySalesEntries(
      user.userId,
      user.tenantId,
      query.year,
    );
  }
}
