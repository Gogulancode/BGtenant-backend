import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CoachService } from "./coach.service";
import { CoachCatchUpDto, CoachGuidanceResponseDto } from "./dto/coach.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Coach")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("coach")
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  @ApiOperation({ summary: "Get coach-led Today guidance" })
  @ApiOkResponse({ type: CoachGuidanceResponseDto })
  @Get("today")
  @Roles(...TENANT_MEMBER_ROLES)
  getToday(@CurrentUser() user: UserContext) {
    return this.coachService.getToday(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get sales page coach guidance" })
  @ApiOkResponse({ type: CoachGuidanceResponseDto })
  @Get("sales")
  @Roles(...TENANT_MEMBER_ROLES)
  getSales(@CurrentUser() user: UserContext) {
    return this.coachService.getSales(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get activities page coach guidance" })
  @ApiOkResponse({ type: CoachGuidanceResponseDto })
  @Get("activities")
  @Roles(...TENANT_MEMBER_ROLES)
  getActivities(@CurrentUser() user: UserContext) {
    return this.coachService.getActivities(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get CRM page coach guidance" })
  @ApiOkResponse({ type: CoachGuidanceResponseDto })
  @Get("crm")
  @Roles(...TENANT_MEMBER_ROLES)
  getCrm(@CurrentUser() user: UserContext) {
    return this.coachService.getCrm(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Save current-week catch-up and refresh guidance" })
  @ApiOkResponse({ type: CoachGuidanceResponseDto })
  @Post("catch-up")
  @Roles(...TENANT_MEMBER_ROLES)
  saveCatchUp(@CurrentUser() user: UserContext, @Body() dto: CoachCatchUpDto) {
    return this.coachService.saveCatchUp(user.userId, user.tenantId, dto);
  }
}
