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
import { OutcomesService } from "./outcomes.service";
import {
  CreateOutcomeDto,
  UpdateOutcomeDto,
  GetOutcomesQueryDto,
  WeeklySummaryQueryDto,
  WeeklySummaryResponseDto,
} from "./dto/outcome.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  TENANT_CONTRIBUTOR_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("Outcomes")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("outcomes")
export class OutcomesController {
  constructor(private outcomesService: OutcomesService) {}

  @ApiOperation({ summary: "Get outcomes for current user" })
  @ApiOkResponse({ description: "Weekly outcomes for the tenant user" })
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getOutcomes(
    @CurrentUser() user: UserContext,
    @Query() query: GetOutcomesQueryDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.outcomesService.getOutcomes(
      user.userId,
      user.tenantId,
      query.weekStart,
      pagination,
    );
  }

  @ApiOperation({ summary: "Create new outcome" })
  @ApiCreatedResponse({ description: "Outcome created" })
  @Post()
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async createOutcome(
    @CurrentUser() user: UserContext,
    @Body() createOutcomeDto: CreateOutcomeDto,
  ) {
    return this.outcomesService.createOutcome(
      user.userId,
      user.tenantId,
      createOutcomeDto,
    );
  }

  @ApiOperation({ summary: "Update outcome" })
  @ApiOkResponse({ description: "Outcome updated" })
  @Put(":id")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async updateOutcome(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body() updateOutcomeDto: UpdateOutcomeDto,
  ) {
    return this.outcomesService.updateOutcome(
      user.userId,
      user.tenantId,
      id,
      updateOutcomeDto,
    );
  }

  @ApiOperation({ summary: "Delete outcome" })
  @ApiOkResponse({ description: "Outcome deleted" })
  @Delete(":id")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async deleteOutcome(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.outcomesService.deleteOutcome(user.userId, user.tenantId, id);
  }

  @ApiOperation({ summary: "Carry forward missed outcomes to next week" })
  @ApiOkResponse({ description: "Carry-forward result summary" })
  @Post("carry-forward")
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async carryForward(@CurrentUser() user: UserContext) {
    return this.outcomesService.carryForwardMissed(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get outcomes summary for dashboard cards" })
  @ApiOkResponse({ description: "Dashboard-ready outcomes summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.outcomesService.getSummary(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get completion rate trend for recent weeks" })
  @ApiOkResponse({ description: "Completion rate per week" })
  @Get("completion-rate")
  @Roles(...TENANT_MEMBER_ROLES)
  async getCompletionRate(
    @CurrentUser() user: UserContext,
    @Query("weeks") weeks?: string,
  ) {
    const parsedWeeks = weeks ? Math.max(1, Math.min(12, Number(weeks))) : 6;
    return this.outcomesService.getCompletionRateTrend(
      user.userId,
      user.tenantId,
      parsedWeeks,
    );
  }

  @ApiOperation({
    summary: "Get weekly outcomes summary",
    description:
      "Compare planned weekly outcomes vs completed outcomes. " +
      "Uses Excel-style week calculation (same as Sales and Activities modules).",
  })
  @ApiOkResponse({
    description: "Weekly summary with planned vs completed count",
    type: WeeklySummaryResponseDto,
  })
  @Get("weekly-summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getWeeklySummary(
    @CurrentUser() user: UserContext,
    @Query() query: WeeklySummaryQueryDto,
  ): Promise<WeeklySummaryResponseDto> {
    return this.outcomesService.getWeeklySummary(
      user.userId,
      user.tenantId,
      query,
    );
  }
}
