import { Controller, Get, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { InsightsService } from "./insights.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import {
  WeeklyDiagnosticsQueryDto,
  WeeklyDiagnosticsResponseDto,
} from "./dto/insights.dto";

@ApiTags("Insights")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("insights")
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @ApiOperation({ summary: "Get user insights (momentum, flags, streaks)" })
  @ApiOkResponse({
    description: "Current insight record for the authenticated tenant user",
    schema: {
      example: {
        id: "insight_123",
        userId: "user_123",
        tenantId: "tenant_123",
        momentumScore: 72.5,
        flags: "Green",
        streakCount: 4,
        updatedAt: "2025-11-14T12:20:00.000Z",
      },
    },
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // Cache for 60 seconds
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getInsights(@CurrentUser() user: UserContext) {
    return this.insightsService.getInsights(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get dashboard-ready insight summary" })
  @ApiOkResponse({
    description: "Aggregated summary for dashboards (wins, focus, recs)",
    schema: {
      example: {
        momentumScore: 68.25,
        flag: "Yellow",
        streakCount: 3,
        updatedAt: "2025-11-14T12:20:00.000Z",
        recommendations: [
          "Schedule a quick daily review to boost consistency.",
          "Close at least one planned outcome this week to move momentum back to green.",
        ],
        recentWins: [
          {
            id: "out_1",
            title: "Publish investor update",
            weekStartDate: "2025-11-10T00:00:00.000Z",
          },
        ],
        focusAreas: [
          {
            id: "act_1",
            title: "Prep Q4 forecast",
            category: "Finance",
            dueDate: "2025-11-17T00:00:00.000Z",
          },
        ],
      },
    },
  })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.insightsService.getSummary(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get focused momentum summary" })
  @ApiOkResponse({
    description: "Momentum-only KPIs for the most recent activity window",
    schema: {
      example: {
        momentumScore: 74.5,
        flag: "Green",
        completionRate: 83.33,
        completedOutcomes: 5,
        totalOutcomes: 6,
        activeDays: 5,
        updatedAt: "2025-11-14T12:20:00.000Z",
      },
    },
  })
  @Get("momentum")
  @Roles(...TENANT_MEMBER_ROLES)
  async getMomentum(@CurrentUser() user: UserContext) {
    return this.insightsService.getMomentumSummary(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get streak health summary" })
  @ApiOkResponse({
    description: "Streak progress plus recommended actions",
    schema: {
      example: {
        streakCount: 4,
        lastActiveDate: "2025-11-13T00:00:00.000Z",
        progressToTarget: 57.14,
        recommendations: [
          "Keep logging key metrics daily to preserve this streak.",
          "Plan one stretch outcome for next week to capitalize on current momentum.",
        ],
      },
    },
  })
  @Get("streak")
  @Roles(...TENANT_MEMBER_ROLES)
  async getStreak(@CurrentUser() user: UserContext) {
    return this.insightsService.getStreakSummary(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get weekly diagnostics explaining performance changes" })
  @ApiOkResponse({
    description: "Rule-based diagnostics with actionable insights",
    type: WeeklyDiagnosticsResponseDto,
  })
  @Get("weekly-diagnostics")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklyDiagnostics(
    @CurrentUser() user: UserContext,
    @Query() query: WeeklyDiagnosticsQueryDto,
  ): Promise<WeeklyDiagnosticsResponseDto> {
    return this.insightsService.getWeeklyDiagnostics(
      user.userId,
      user.tenantId,
      query,
    );
  }
}
