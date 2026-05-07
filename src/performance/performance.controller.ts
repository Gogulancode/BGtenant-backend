import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { PerformanceService } from "./performance.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { TENANT_LEADERSHIP_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Performance")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TENANT_LEADERSHIP_ROLES)
@Controller("performance")
export class PerformanceController {
  constructor(private performanceService: PerformanceService) {}

  @ApiOperation({
    summary: "Get performance analytics (top coaches, top/bottom SMEs)",
  })
  @ApiOkResponse({ description: "Performance analytics payload" })
  @Get("analytics")
  async getAnalytics(@CurrentUser() user: UserContext) {
    return this.performanceService.getPerformanceAnalytics(user);
  }
}
