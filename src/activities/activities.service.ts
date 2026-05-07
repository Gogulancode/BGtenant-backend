import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
  WeeklySummaryQueryDto,
  WeeklySummaryResponseDto,
  WeeklySummaryItemDto,
} from "./dto/activity.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { createPaginatedResponse } from "../common/dto/pagination.dto";
import {
  getWeekNumber,
  getCurrentWeekNumber,
  getWeekDateRange,
} from "../common/utils/date.utils";

// Category names that map to ActivityConfiguration fields
const CATEGORY_CONFIG_MAP: Record<string, string> = {
  Sales: "salesEnabled",
  Marketing: "marketingEnabled",
  Networking: "networkingEnabled",
  "Product Dev": "productDevEnabled",
  Operations: "operationsEnabled",
};

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async getAllActivities(
    userId: string,
    tenantId: string | null | undefined,
    query?: ActivityQueryDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    // Build where clause with filters
    const where: any = { userId, tenantId: scopedTenantId };

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.priority) {
      where.priority = query.priority;
    }

    if (query?.dueDateFrom || query?.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) {
        where.dueDate.gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        where.dueDate.lte = new Date(query.dueDateTo);
      }
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // If no pagination query provided, return all (backward compatible)
    if (!query || (query.page === 1 && query.pageSize === 20 && !query.search)) {
      const activities = await this.prisma.activity.findMany({
        where,
        orderBy: query?.getOrderBy(["createdat", "duedate", "title", "priority"]) ?? { createdAt: "desc" },
      });
      return activities;
    }

    // Paginated response
    const orderBy = query.getOrderBy(["createdat", "duedate", "title", "priority"]);

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return createPaginatedResponse(activities, total, query);
  }

  async createActivity(
    userId: string,
    tenantId: string | null | undefined,
    createActivityDto: CreateActivityDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.activity.create({
      data: { userId, tenantId: scopedTenantId, ...createActivityDto },
    });
  }

  async updateActivity(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
    updateActivityDto: UpdateActivityDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const existing = await this.prisma.activity.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });

    if (!existing) {
      throw new NotFoundException("Activity not found");
    }

    return this.prisma.activity.update({
      where: { id },
      data: updateActivityDto,
    });
  }

  async deleteActivity(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const existing = await this.prisma.activity.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });

    if (!existing) {
      throw new NotFoundException("Activity not found");
    }

    return this.prisma.activity.delete({ where: { id } });
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const now = new Date();

    const [statusCounts, categoryCounts, overdue, upcoming] = await Promise.all(
      [
        this.prisma.activity.groupBy({
          where: { userId, tenantId: scopedTenantId },
          by: ["status"],
          _count: { status: true },
        }),
        this.prisma.activity.groupBy({
          where: { userId, tenantId: scopedTenantId },
          by: ["category"],
          _count: { category: true },
        }),
        this.prisma.activity.count({
          where: {
            userId,
            tenantId: scopedTenantId,
            dueDate: { lt: now },
            status: { not: "Completed" },
          },
        }),
        this.prisma.activity.findMany({
          where: {
            userId,
            tenantId: scopedTenantId,
            status: "Active",
            dueDate: { gte: now },
          },
          orderBy: { dueDate: "asc" },
          take: 3,
          select: { id: true, title: true, category: true, dueDate: true },
        }),
      ],
    );

    return {
      status: statusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      categories: categoryCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.category ?? "Uncategorized"] = item._count.category;
        return acc;
      }, {}),
      overdue,
      upcoming,
    };
  }

  /**
   * Get weekly summary comparing planned activity targets vs actual logged activities.
   * Uses the same week calculation logic as Sales module (Excel-style).
   */
  async getWeeklySummary(
    userId: string,
    tenantId: string | null | undefined,
    query: WeeklySummaryQueryDto,
  ): Promise<WeeklySummaryResponseDto> {
    const scopedTenantId = assertTenantContext(tenantId);

    // Determine year and week
    const year = query.year ?? new Date().getFullYear();
    const week = query.week ?? getCurrentWeekNumber();

    // Get week date boundaries (same logic as Sales)
    const { start: startOfWeek, end: endOfWeek } = getWeekDateRange(year, week);

    // Load activity configuration for tenant
    const config = await this.prisma.activityConfiguration.findUnique({
      where: { tenantId: scopedTenantId },
    });

    // If no configuration, return empty response
    if (!config) {
      return {
        year,
        week,
        items: [],
        overallCompletionPercent: 0,
      };
    }

    // Determine enabled categories and their targets
    const enabledCategories = this.getEnabledCategories(config);

    // If no categories enabled, return empty
    if (enabledCategories.length === 0) {
      return {
        year,
        week,
        items: [],
        overallCompletionPercent: 0,
      };
    }

    // Calculate per-category target (evenly distributed)
    const weeklyGoal = config.weeklyActivityGoal ?? 5;
    const perCategoryTarget = Math.floor(weeklyGoal / enabledCategories.length);

    // Fetch activities for this tenant and user in the week range
    const activities = await this.prisma.activity.findMany({
      where: {
        userId,
        tenantId: scopedTenantId,
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: { category: true },
    });

    // Group activities by category
    const categoryCountMap: Record<string, number> = {};
    for (const activity of activities) {
      const cat = activity.category ?? "Other";
      categoryCountMap[cat] = (categoryCountMap[cat] ?? 0) + 1;
    }

    // Build items array for each enabled category
    const items: WeeklySummaryItemDto[] = enabledCategories.map((category) => {
      const target = perCategoryTarget;
      const actual = categoryCountMap[category] ?? 0;
      const completionPercent =
        target > 0 ? Math.round((actual / target) * 100 * 10) / 10 : 0;

      return {
        category,
        target,
        actual,
        completionPercent,
      };
    });

    // Calculate overall completion
    const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
    const totalActual = items.reduce((sum, item) => sum + item.actual, 0);
    const overallCompletionPercent =
      totalTarget > 0
        ? Math.round((totalActual / totalTarget) * 100 * 10) / 10
        : 0;

    return {
      year,
      week,
      items,
      overallCompletionPercent,
    };
  }

  /**
   * Get list of enabled categories from ActivityConfiguration
   */
  private getEnabledCategories(config: {
    salesEnabled: boolean;
    marketingEnabled: boolean;
    networkingEnabled: boolean;
    productDevEnabled: boolean;
    operationsEnabled: boolean;
  }): string[] {
    const categories: string[] = [];
    if (config.salesEnabled) categories.push("Sales");
    if (config.marketingEnabled) categories.push("Marketing");
    if (config.networkingEnabled) categories.push("Networking");
    if (config.productDevEnabled) categories.push("Product Dev");
    if (config.operationsEnabled) categories.push("Operations");
    return categories;
  }
}
