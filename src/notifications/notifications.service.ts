import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";

type NotificationScope = {
  tenantId?: string | null;
  userId: string;
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(tenantId: string | null | undefined, userId: string) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where = this.visibleWhere(scopedTenantId, userId);

    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  async unreadCount(tenantId: string | null | undefined, userId: string) {
    const scopedTenantId = assertTenantContext(tenantId);
    const count = await this.prisma.notification.count({
      where: {
        ...this.visibleWhere(scopedTenantId, userId),
        isRead: false,
      },
    });
    return { count };
  }

  async markRead(
    tenantId: string | null | undefined,
    userId: string,
    notificationId: string,
  ) {
    const notification = await this.findScopedNotification(
      { tenantId, userId },
      notificationId,
    );

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string | null | undefined, userId: string) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.notification.updateMany({
      where: {
        ...this.visibleWhere(scopedTenantId, userId),
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  private async findScopedNotification(
    scope: NotificationScope,
    notificationId: string,
  ) {
    const scopedTenantId = assertTenantContext(scope.tenantId);
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    if (
      notification.tenantId !== scopedTenantId ||
      (notification.userId !== null && notification.userId !== scope.userId)
    ) {
      throw new ForbiddenException("Notification is outside of your scope");
    }

    return notification;
  }

  private visibleWhere(tenantId: string, userId: string) {
    return {
      tenantId,
      OR: [{ userId }, { userId: null }],
    };
  }
}
