import { Controller, Get, Delete, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { SessionsService } from "./sessions.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

const sessionExample = {
  id: "sess_123",
  ipAddress: "10.0.0.12",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2)",
  createdAt: "2025-11-15T12:00:00.000Z",
  expiresAt: "2025-12-15T12:00:00.000Z",
};

const revokeMessageExample = { message: "Session revoked successfully" };

@ApiTags("Sessions")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sessions")
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @ApiOperation({ summary: "Get my active sessions" })
  @ApiOkResponse({
    description: "Active refresh-token backed sessions for the user",
    schema: { example: [sessionExample] },
  })
  @Get("my")
  @Roles(...TENANT_MEMBER_ROLES)
  async getMySessions(@CurrentUser() user: UserContext) {
    return this.sessionsService.getActiveSessions(user.userId);
  }

  @ApiOperation({ summary: "Revoke specific session (force logout)" })
  @ApiOkResponse({
    description: "Confirmation message and audit trail",
    schema: { example: revokeMessageExample },
  })
  @Delete(":id")
  @Roles(...TENANT_MEMBER_ROLES)
  async revokeSession(@Param("id") id: string, @CurrentUser() user: UserContext) {
    return this.sessionsService.revokeSession(id, user);
  }

  @ApiOperation({ summary: "Revoke all my sessions except current" })
  @ApiOkResponse({
    description: "Confirmation message and audit trail",
    schema: { example: { message: "All sessions revoked successfully" } },
  })
  @Delete("my/all")
  @Roles(...TENANT_MEMBER_ROLES)
  async revokeAllMySessions(@CurrentUser() user: UserContext) {
    return this.sessionsService.revokeAllSessions(user);
  }
}
