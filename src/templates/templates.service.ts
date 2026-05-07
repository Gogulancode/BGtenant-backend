import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Templates Service - READ-ONLY for Tenants
 *
 * Templates are global resources managed by Superadmin only.
 * This service only exposes read operations for tenant users.
 * Tenants can apply templates to create their own metrics/outcomes/activities.
 *
 * For template CRUD operations, see the Superadmin backend:
 * - superadmin-backend/src/templates/templates.service.ts
 */
@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  // Metric Templates (Read-Only)
  async getAllMetricTemplates() {
    return this.prisma.metricTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  // Outcome Templates (Read-Only)
  async getAllOutcomeTemplates() {
    return this.prisma.outcomeTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  // Activity Templates (Read-Only)
  async getAllActivityTemplates() {
    return this.prisma.activityTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  // Apply Metric Template - creates a new Metric for the user
  async applyMetricTemplate(templateId: string, userId: string, tenantId: string, customTarget?: number) {
    const template = await this.prisma.metricTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException("Metric template not found");
    }

    // Use custom target if provided, otherwise use template's default target
    const target = customTarget !== undefined ? customTarget : template.targetValue;

    return this.prisma.metric.create({
      data: {
        userId,
        tenantId,
        name: template.name,
        target,
      },
    });
  }

  // Apply Outcome Template - creates a new Outcome for the user
  async applyOutcomeTemplate(templateId: string, userId: string, tenantId: string) {
    const template = await this.prisma.outcomeTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException("Outcome template not found");
    }

    // Calculate current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStartDate = new Date(now.setDate(diff));
    weekStartDate.setHours(0, 0, 0, 0);

    return this.prisma.outcome.create({
      data: {
        userId,
        tenantId,
        title: template.title,
        weekStartDate,
        status: "Planned",
      },
    });
  }

  // Apply Activity Template - creates a new Activity for the user
  async applyActivityTemplate(templateId: string, userId: string, tenantId: string) {
    const template = await this.prisma.activityTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException("Activity template not found");
    }

    return this.prisma.activity.create({
      data: {
        userId,
        tenantId,
        title: template.name,
        category: template.category || "General",
        status: "Pending",
      },
    });
  }
}
