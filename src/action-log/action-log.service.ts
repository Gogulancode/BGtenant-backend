import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ActionLogMetadata {
  [key: string]: unknown;
}

@Injectable()
export class ActionLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Records an action in the audit log.
   * @param userId - The ID of the user performing the action
   * @param tenantId - The tenant context (null for system-level actions)
   * @param action - The action being performed (e.g., "CREATE_TICKET")
   * @param resource - The resource type/module (e.g., "support", "templates")
   * @param metadata - Optional additional context about the action
   */
  async record(
    userId: string,
    tenantId: string | null,
    action: string,
    resource: string,
    metadata?: ActionLogMetadata,
  ) {
    return this.prisma.actionLog.create({
      data: {
        userId,
        tenantId,
        action,
        module: resource,
        details: metadata as any,
      },
    });
  }

  async getAll(limit = 100) {
    return this.prisma.actionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getByUser(userId: string, limit = 50) {
    return this.prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getByTenant(tenantId: string, limit = 100) {
    return this.prisma.actionLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
