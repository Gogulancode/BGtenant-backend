import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { BusinessService } from "./business.service";
import { SnapshotDto } from "./dto/snapshot.dto";
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

@ApiTags("Business")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("business")
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @ApiOperation({ summary: "Create or update business snapshot" })
  @ApiOkResponse({ description: "Saved business snapshot" })
  @Post("snapshot")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async upsertSnapshot(
    @CurrentUser() user: UserContext,
    @Body() snapshotDto: SnapshotDto,
  ) {
    return this.businessService.upsertSnapshot(
      user.userId,
      user.tenantId,
      snapshotDto,
    );
  }

  @ApiOperation({ summary: "Get business snapshot" })
  @ApiOkResponse({ description: "Current business snapshot" })
  @Get("snapshot")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSnapshot(@CurrentUser() user: UserContext) {
    return this.businessService.getSnapshot(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get suggested North Star Metric (NSM)" })
  @ApiOkResponse({ description: "Suggested NSM" })
  @Get("nsm")
  @Roles(...TENANT_MEMBER_ROLES)
  async getNSM(@CurrentUser() user: UserContext) {
    return this.businessService.getNSM(user.userId, user.tenantId);
  }

  @ApiOperation({ summary: "Get business summary for dashboard readiness" })
  @ApiOkResponse({ description: "Business readiness summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.businessService.getSummary(user.userId, user.tenantId);
  }
}
