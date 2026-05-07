import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import {
  TENANT_LEADERSHIP_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Reports")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @ApiOperation({ summary: "Get one-page business profile report" })
  @ApiOkResponse({ description: "Business profile report returned" })
  @Roles(...TENANT_MEMBER_ROLES)
  @Get("business-profile")
  async getBusinessProfile(@CurrentUser() user: UserContext) {
    return this.reportsService.getBusinessProfileReport(user);
  }

  @ApiOperation({ summary: "Generate PDF report (Weekly/Monthly)" })
  @ApiCreatedResponse({ description: "Report generation request accepted" })
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @Post("generate")
  async generateReport(
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.reportsService.generateReport(dto, user);
  }
}
