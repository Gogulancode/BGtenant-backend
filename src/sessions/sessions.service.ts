import { ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ActionLogService } from "../action-log/action-log.service";
import { assertTenantContext } from "../common/utils/tenant.utils";

type CurrentUserLike = {
  userId: string;
  tenantId?: string | null;
  role: Role;
};

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private actionLog: ActionLogService,
  ) {}

  async getActiveSessions(userId: string) {
    const now = new Date();
    return this.prisma.refreshToken.findMany({
      where: { userId, revoked: false, expiresAt: { gt: now } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeSession(sessionId: string, requester: CurrentUserLike) {
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    if (!session) {
      return { error: "Session not found" };
    }

    this.assertSessionAccess(session, requester);

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revoked: true },
    });

    await this.actionLog.record(
      requester.userId,
      requester.tenantId ?? null,
      "REVOKE_SESSION",
      sessionId,
      {
        targetUserId: session.userId,
      },
    );

    return { message: "Session revoked successfully" };
  }

  async revokeAllSessions(requester: CurrentUserLike, exceptCurrent?: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: requester.userId,
        revoked: false,
        ...(exceptCurrent ? { id: { not: exceptCurrent } } : {}),
      },
      data: { revoked: true },
    });

    await this.actionLog.record(
      requester.userId,
      requester.tenantId ?? null,
      "REVOKE_ALL_SESSIONS",
      requester.userId,
    );

    return { message: "All sessions revoked successfully" };
  }

  private assertSessionAccess(
    session: { userId: string; user?: { tenantId: string | null } | null },
    requester: CurrentUserLike,
  ) {
    if (session.userId === requester.userId) {
      return;
    }

    const allowedTenantRoles: Role[] = [Role.TENANT_ADMIN, Role.MANAGER];
    if (!allowedTenantRoles.includes(requester.role)) {
      throw new ForbiddenException("You cannot manage other users sessions");
    }

    const scopedTenantId = assertTenantContext(requester.tenantId);
    if (!session.user?.tenantId || session.user.tenantId !== scopedTenantId) {
      throw new ForbiddenException("Session is outside of your tenant");
    }
  }
}
