import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Post,
  Query,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { UserService } from "./user.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
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
import {
  InviteTenantUserDto,
  TenantUserQueryDto,
  UpdateTenantUserRoleDto,
  UpdateTenantUserStatusDto,
} from "./dto/manage-user.dto";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

const tenantUserExample = {
  id: "user_123",
  name: "Ava Growth",
  email: "ava@example.com",
  businessType: "Startup",
  role: "TENANT_ADMIN",
  isActive: true,
  timezone: "America/New_York",
  notificationsEmail: true,
  notificationsPush: true,
  createdAt: "2025-11-15T12:00:00.000Z",
  updatedAt: "2025-11-15T12:05:00.000Z",
};

const tenantInvitationExample = {
  invitationId: "inv_123",
  expiresAt: "2025-11-18T12:00:00.000Z",
  user: tenantUserExample,
};

@ApiTags("User")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UserController {
  constructor(private userService: UserService) {}

  @ApiOperation({ summary: "Get current user profile" })
  @ApiOkResponse({
    description: "Current tenant user profile",
    schema: { example: tenantUserExample },
  })
  @Get("me")
  @Roles(...TENANT_MEMBER_ROLES)
  async getProfile(@CurrentUser() user: UserContext) {
    return this.userService.getProfile(user.userId);
  }

  @ApiOperation({ summary: "Update user profile" })
  @ApiOkResponse({
    description: "Updated tenant user profile",
    schema: { example: tenantUserExample },
  })
  @Put("me")
  @Roles(...TENANT_MEMBER_ROLES)
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, updateProfileDto);
  }

  @ApiOperation({ summary: "List users in my tenant (admin only)" })
  @ApiOkResponse({
    description: "Filtered list of tenant users",
    schema: { example: [tenantUserExample] },
  })
  @Get()
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async listTenantUsers(
    @CurrentUser() user: UserContext,
    @Query() query: TenantUserQueryDto,
  ) {
    return this.userService.listTenantUsers(user.tenantId, query);
  }

  @ApiOperation({ summary: "Invite new tenant user (TENANT_ADMIN)" })
  @ApiCreatedResponse({
    description: "Invitation created and notification queued",
    schema: { example: tenantInvitationExample },
  })
  @Post()
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async inviteTenantUser(
    @CurrentUser() user: UserContext,
    @Body() dto: InviteTenantUserDto,
  ) {
    return this.userService.inviteTenantUser(user.userId, user.tenantId, dto);
  }

  @ApiOperation({ summary: "Update tenant user role (TENANT_ADMIN)" })
  @ApiOkResponse({
    description: "Tenant user role updated",
    schema: { example: tenantUserExample },
  })
  @Put(":id/role")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async updateTenantUserRole(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateTenantUserRoleDto,
  ) {
    return this.userService.updateTenantUserRole(
      user.userId,
      user.tenantId,
      id,
      dto,
    );
  }

  @ApiOperation({
    summary: "Activate or deactivate tenant user (TENANT_ADMIN)",
  })
  @ApiOkResponse({
    description: "Tenant user status updated",
    schema: { example: tenantUserExample },
  })
  @Patch(":id/status")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  async updateTenantUserStatus(
    @Param("id") id: string,
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateTenantUserStatusDto,
  ) {
    return this.userService.updateTenantUserStatus(
      user.userId,
      user.tenantId,
      id,
      dto,
    );
  }
}
