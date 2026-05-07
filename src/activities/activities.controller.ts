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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { ActivitiesService } from "./activities.service";
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
  WeeklySummaryQueryDto,
  WeeklySummaryResponseDto,
} from "./dto/activity.dto";
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
  TENANT_CONTRIBUTOR_ROLES,
} from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Activities")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("activities")
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @ApiOperation({ summary: "Get all activities with optional filters and pagination" })
  @ApiOkResponse({
    description: "Returns paginated activities assigned to the authenticated tenant user",
  })
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getAllActivities(
    @CurrentUser() user: UserContext,
    @Query() query: ActivityQueryDto,
  ) {
    return this.activitiesService.getAllActivities(user.userId, user.tenantId, query);
  }

  @ApiOperation({ summary: "Create activity" })
  @ApiCreatedResponse({ description: "Activity created for current tenant" })
  @Post()
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async createActivity(
    @CurrentUser() user: UserContext,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivity(
      user.userId,
      user.tenantId,
      createActivityDto,
    );
  }

  @ApiOperation({ summary: "Update activity" })
  @ApiOkResponse({ description: "Updated activity details" })
  @Put(":id")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async updateActivity(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.activitiesService.updateActivity(
      user.userId,
      user.tenantId,
      id,
      updateActivityDto,
    );
  }

  @ApiOperation({ summary: "Delete activity" })
  @ApiOkResponse({ description: "Activity deleted" })
  @Delete(":id")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async deleteActivity(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.activitiesService.deleteActivity(
      user.userId,
      user.tenantId,
      id,
    );
  }

  @ApiOperation({ summary: "Get activities summary for dashboard" })
  @ApiOkResponse({ description: "Aggregated activity summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.activitiesService.getSummary(user.userId, user.tenantId);
  }

  @ApiOperation({
    summary: "Get weekly activity summary",
    description:
      "Compare planned weekly activity targets (from onboarding) vs actual logged activities. " +
      "Uses Excel-style week calculation (same as Sales module).",
  })
  @ApiOkResponse({
    description: "Weekly summary with target vs actual per category",
    type: WeeklySummaryResponseDto,
  })
  @Get("weekly-summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklySummary(
    @CurrentUser() user: UserContext,
    @Query() query: WeeklySummaryQueryDto,
  ): Promise<WeeklySummaryResponseDto> {
    return this.activitiesService.getWeeklySummary(
      user.userId,
      user.tenantId,
      query,
    );
  }
}
