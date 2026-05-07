import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { SettingsService } from "./settings.service";
import { RolesGuard } from "../common/guards/roles.guard";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { UpdateBusinessSetupChecklistDto } from "./dto/business-setup-checklist.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

const userSettingsExample = {
  timezone: "America/Los_Angeles",
  notificationsEmail: true,
  notificationsPush: false,
};

const businessSetupChecklistExample = {
  id: "checklist_123",
  tenantId: "tenant_123",
  uspDefined: true,
  uspValue: "We deliver results 50% faster",
  menuCardDefined: false,
  menuCardValue: null,
  packagesDefined: false,
  packagesValue: null,
  customerSegmentDefined: true,
  customerSegmentValue: "SMBs in tech industry",
  completedSteps: 2,
  totalSteps: 4,
  completionPercent: 50,
};

@ApiTags("Settings")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TENANT_MEMBER_ROLES)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: "Get user settings" })
  @ApiOkResponse({
    description: "Current tenant user settings",
    schema: { example: userSettingsExample },
  })
  @Get()
  async getSettings(@CurrentUser() user: UserContext) {
    return this.settingsService.getSettings(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Update personal settings" })
  @ApiOkResponse({
    description: "Updated tenant user settings",
    schema: { example: userSettingsExample },
  })
  @Patch()
  async updateSettings(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user.userId, user.tenantId, dto);
  }

  // ============================================
  // BUSINESS SETUP CHECKLIST ENDPOINTS
  // ============================================

  @ApiOperation({ summary: "Get business setup checklist" })
  @ApiOkResponse({
    description: "Business setup checklist with completion stats",
    schema: { example: businessSetupChecklistExample },
  })
  @Get("business-setup")
  async getBusinessSetupChecklist(@CurrentUser() user: UserContext) {
    return this.settingsService.getBusinessSetupChecklist(user.tenantId);
  }

  @ApiOperation({ summary: "Update business setup checklist" })
  @ApiOkResponse({
    description: "Updated business setup checklist with completion stats",
    schema: { example: businessSetupChecklistExample },
  })
  @Patch("business-setup")
  async updateBusinessSetupChecklist(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateBusinessSetupChecklistDto,
  ) {
    return this.settingsService.updateBusinessSetupChecklist(
      user.userId,
      user.tenantId,
      dto,
    );
  }
}
