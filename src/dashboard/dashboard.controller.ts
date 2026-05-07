import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiOkResponse } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Dashboard")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: "Get consolidated dashboard summary" })
  @ApiOkResponse({ description: "Consolidated dashboard payload" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.dashboardService.getSummary(user.userId, user.tenantId);
  }
}
