import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { CurrentUser, UserContext } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER)
@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @ApiOperation({ summary: "List current user's notifications" })
  @ApiOkResponse({ description: "Notification list and unread count" })
  @Get()
  async list(@CurrentUser() user: UserContext) {
    return this.notificationsService.listForUser(user.tenantId, user.userId);
  }

  @ApiOperation({ summary: "Get unread notification count" })
  @ApiOkResponse({ description: "Unread notification count" })
  @Get("unread-count")
  async unreadCount(@CurrentUser() user: UserContext) {
    return this.notificationsService.unreadCount(user.tenantId, user.userId);
  }

  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiOkResponse({ description: "Number of notifications updated" })
  @Patch("read-all")
  async markAllRead(@CurrentUser() user: UserContext) {
    return this.notificationsService.markAllRead(user.tenantId, user.userId);
  }

  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiOkResponse({ description: "Updated notification" })
  @Patch(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: UserContext) {
    return this.notificationsService.markRead(user.tenantId, user.userId, id);
  }
}
