import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActionLogService } from "../action-log/action-log.service";
import { Role, TenantType, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class SuperadminService {
  constructor(
    private prisma: PrismaService,
    private actionLog: ActionLogService,
  ) {}

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  async getDashboardSummary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count tenants by status
    const [
      totalTenants,
      activeTenants,
      createdLast7Days,
      totalUsers,
      totalMetrics,
      totalOutcomes,
      openTickets,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenant.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.user.count({ where: { role: { not: Role.SUPER_ADMIN } } }),
      this.prisma.metricLog.count(),
      this.prisma.outcome.count(),
      this.prisma.ticket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
    ]);

    const inactiveTenants = totalTenants - activeTenants;

    // Activity trend (last 7 days)
    const activityTrend = await this.getActivityTrend(sevenDaysAgo);

    // Tenant growth (last 6 months)
    const tenantGrowthSeries = await this.getTenantGrowthSeries();

    // Top tenants by activity
    const topTenantsByActivity = await this.getTopTenantsByActivity();

    return {
      totalTenants,
      activeTenants,
      inactiveTenants,
      createdLast7Days,
      totalUsers,
      totalMetrics,
      totalOutcomes,
      openTickets,
      activityTrend,
      tenantGrowthSeries,
      topTenantsByActivity,
    };
  }

  private async getActivityTrend(since: Date) {
    // Get daily activity counts for the last 7 days
    const logs = await this.prisma.actionLog.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: since } },
      _count: true,
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};
    logs.forEach((log) => {
      const dateStr = new Date(log.createdAt).toISOString().split("T")[0];
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + log._count;
    });

    return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
  }

  private async getTenantGrowthSeries() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const tenants = await this.prisma.tenant.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    // Group by month
    const monthlyCounts: Record<string, number> = {};
    tenants.forEach((t) => {
      const monthStr = new Date(t.createdAt).toISOString().slice(0, 7);
      monthlyCounts[monthStr] = (monthlyCounts[monthStr] || 0) + 1;
    });

    return Object.entries(monthlyCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));
  }

  private async getTopTenantsByActivity(limit = 5) {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            users: true,
            metrics: true,
            outcomes: true,
            activities: true,
          },
        },
      },
      take: limit,
    });

    return tenants
      .map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        activityScore:
          t._count.users + t._count.metrics + t._count.outcomes + t._count.activities,
      }))
      .sort((a, b) => b.activityScore - a.activityScore);
  }

  // ============================================================================
  // TENANTS
  // ============================================================================

  async getTenants(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    // Ensure numeric values with proper defaults
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { status, search, sortBy = "createdAt", sortOrder = "desc" } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: { select: { users: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const data = tenants.map((t) => this.formatTenant(t));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
        _count: {
          select: { users: true, metrics: true, outcomes: true, activities: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException("Tenant not found");

    return this.formatTenantDetails(tenant);
  }

  async createTenant(dto: {
    name: string;
    email: string;
    slug?: string;
    type?: TenantType;
    domain?: string;
    adminEmail?: string;
    adminName?: string;
    adminPassword?: string;
    plan?: SubscriptionPlan;
  }) {
    // Auto-generate slug from name if not provided
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Check if slug is unique
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException("Tenant slug already exists");
    }

    // Check if admin email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail || dto.email },
    });
    if (existingUser) {
      throw new BadRequestException("Admin email already registered");
    }

    // Auto-generate password if not provided (first 4 chars of name + random 4 digits)
    const autoPassword = dto.adminPassword || `${dto.name.slice(0, 4)}${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Hash admin password
    const passwordHash = await bcrypt.hash(autoPassword, 10);

    // Create tenant with admin user
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type || TenantType.COMPANY,
        email: dto.email,
        domain: dto.domain,
        status: "active",
        isActive: true,
        users: {
          create: {
            name: dto.adminName || dto.name + ' Admin',
            email: dto.adminEmail || dto.email,
            passwordHash,
            role: Role.TENANT_ADMIN,
            isActive: true,
          },
        },
        subscriptions: dto.plan
          ? {
              create: {
                plan: dto.plan,
                status: SubscriptionStatus.TRIAL,
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            }
          : undefined,
      },
      include: {
        subscriptions: { take: 1 },
        _count: { select: { users: true } },
      },
    });

    // TODO: Send welcome email to admin with credentials
    // For now, log the credentials (remove in production)
    console.log(`[TENANT CREATED] ${dto.name}`);
    console.log(`  Admin Email: ${dto.adminEmail || dto.email}`);
    console.log(`  Temp Password: ${autoPassword}`);
    console.log(`  Tenant Dashboard: http://localhost:8080`);

    return {
      ...this.formatTenant(tenant),
      // Include credentials in response for demo (remove in production)
      adminCredentials: {
        email: dto.adminEmail || dto.email,
        tempPassword: autoPassword,
        loginUrl: 'http://localhost:8080',
      },
    };
  }

  async updateTenant(
    id: string,
    dto: {
      name?: string;
      email?: string;
      domain?: string;
      status?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        domain: dto.domain,
        status: dto.status,
        isActive: dto.status === "active",
      },
      include: {
        subscriptions: { take: 1 },
        _count: { select: { users: true } },
      },
    });

    return this.formatTenant(updated);
  }

  async activateTenant(id: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: true, status: "active" },
    });
  }

  async deactivateTenant(id: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: false, status: "suspended" },
    });
  }

  async deleteTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    await this.prisma.tenant.delete({ where: { id } });
    return { message: "Tenant deleted successfully" };
  }

  async updateTenantSubscription(
    id: string,
    dto: { plan: SubscriptionPlan },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscriptions: { take: 1 } },
    });

    if (!tenant) throw new NotFoundException("Tenant not found");

    if (tenant.subscriptions.length > 0) {
      await this.prisma.subscription.update({
        where: { id: tenant.subscriptions[0].id },
        data: { plan: dto.plan },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          tenantId: id,
          plan: dto.plan,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    return { message: "Subscription updated successfully" };
  }

  async resetTenantAdminPassword(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: Role.TENANT_ADMIN },
          take: 1,
        },
      },
    });

    if (!tenant) throw new NotFoundException("Tenant not found");

    const adminUser = tenant.users[0];
    if (!adminUser) {
      throw new NotFoundException("No admin user found for this tenant");
    }

    // Generate new password (first 4 chars of tenant name + random 4 digits)
    const newPassword = `${tenant.name.slice(0, 4).replace(/\s/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update admin user password
    await this.prisma.user.update({
      where: { id: adminUser.id },
      data: { passwordHash },
    });

    console.log(`[PASSWORD RESET] ${tenant.name}`);
    console.log(`  Admin Email: ${adminUser.email}`);
    console.log(`  New Password: ${newPassword}`);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminCredentials: {
        email: adminUser.email,
        tempPassword: newPassword,
        loginUrl: 'http://localhost:8080',
      },
    };
  }

  async getTenantStats(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [userCount, metricsLogged, outcomesCompleted, activitiesLogged, salesLogged, insights] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId: id } }),
        this.prisma.metricLog.count({ where: { metric: { tenantId: id } } }),
        this.prisma.outcome.count({ where: { tenantId: id, status: 'Done' } }),
        this.prisma.activity.count({ where: { tenantId: id } }),
        this.prisma.salesTracker.count({ where: { tenantId: id } }),
        this.prisma.insight.findMany({ 
          where: { tenantId: id },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        }),
      ]);

    const latestInsight = insights[0];
    const momentumScore = latestInsight?.momentumScore || 0;
    const streak = latestInsight?.streakCount || 0;

    return {
      tenantId: id,
      tenantName: tenant.name,
      status: tenant.isActive ? 'ACTIVE' : 'INACTIVE',
      lastActiveAt: tenant.lastActiveAt,
      metricsLogged,
      outcomesCompleted,
      activitiesLogged,
      salesLogged,
      momentumScore,
      streak,
      isOnboarded: tenant.isOnboarded,
      onboardingStep: tenant.onboardingStep,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
    };
  }

  private formatTenant(tenant: any) {
    const subscription = tenant.subscriptions?.[0];
    // Normalize status to uppercase for frontend compatibility
    const rawStatus = tenant.status || (tenant.isActive ? "active" : "inactive");
    const status = rawStatus.toUpperCase();
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      email: tenant.email,
      domain: tenant.domain,
      status,
      isActive: tenant.isActive,
      isOnboarded: tenant.isOnboarded,
      onboardingStep: tenant.onboardingStep,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
      lastActiveAt: tenant.lastActiveAt,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
          }
        : null,
      userCount: tenant._count?.users || 0,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private formatTenantDetails(tenant: any) {
    return {
      ...this.formatTenant(tenant),
      users: tenant.users,
      counts: tenant._count,
    };
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  async getTemplates(query: {
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    scope?: string;
    status?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { type, search, scope, status } = query;
    const skip = (page - 1) * limit;

    // We'll combine all template types
    const [metricTemplates, outcomeTemplates, activityTemplates] = await Promise.all([
      this.prisma.metricTemplate.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
      }),
      this.prisma.outcomeTemplate.findMany({
        where: search ? { title: { contains: search, mode: "insensitive" } } : undefined,
      }),
      this.prisma.activityTemplate.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
      }),
    ]);

    const templates = [
      ...metricTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.targetValue ? `Target: ${t.targetValue}` : '',
        type: "metric" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: null as string | null,
        frequency: t.frequency || null,
        targetValue: t.targetValue || null,
        metricSchema: [{
          name: t.name,
          type: "number" as const,
          unit: t.frequency || undefined,
          description: `Target value: ${t.targetValue}`,
        }],
        usedByTenantsCount: 0,
        createdAt: t.createdAt,
        updatedAt: t.createdAt,
      })),
      ...outcomeTemplates.map((t) => ({
        id: t.id,
        name: t.title,
        description: t.description || '',
        type: "outcome" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: null as string | null,
        frequency: null as string | null,
        targetValue: null as number | null,
        metricSchema: [],
        usedByTenantsCount: 0,
        createdAt: t.createdAt,
        updatedAt: t.createdAt,
      })),
      ...activityTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: '',
        type: "activity" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: t.category || null,
        frequency: t.frequency || null,
        targetValue: null as number | null,
        metricSchema: [],
        usedByTenantsCount: 0,
        createdAt: t.createdAt,
        updatedAt: t.createdAt,
      })),
    ];

    // Filter by type if specified
    let filtered = type ? templates.filter((t) => t.type === type) : templates;
    
    // Filter by scope if specified
    if (scope) {
      filtered = filtered.filter((t) => t.scope === scope);
    }
    
    // Filter by status if specified
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    // Sort by createdAt desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const data = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTemplateByIdAuto(id: string) {
    // Try to find in all template tables
    const [metric, outcome, activity] = await Promise.all([
      this.prisma.metricTemplate.findUnique({ where: { id } }),
      this.prisma.outcomeTemplate.findUnique({ where: { id } }),
      this.prisma.activityTemplate.findUnique({ where: { id } }),
    ]);

    if (metric) {
      return {
        id: metric.id,
        name: metric.name,
        description: metric.targetValue ? `Target: ${metric.targetValue}` : '',
        type: "metric" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: null as string | null,
        frequency: metric.frequency || null,
        targetValue: metric.targetValue || null,
        metricSchema: [{
          name: metric.name,
          type: "number" as const,
          unit: metric.frequency || undefined,
          description: `Target value: ${metric.targetValue}`,
        }],
        usedByTenantsCount: 0,
        createdAt: metric.createdAt,
        updatedAt: metric.createdAt,
      };
    }

    if (outcome) {
      return {
        id: outcome.id,
        name: outcome.title,
        description: outcome.description || '',
        type: "outcome" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: null as string | null,
        frequency: null as string | null,
        targetValue: null as number | null,
        metricSchema: [],
        usedByTenantsCount: 0,
        createdAt: outcome.createdAt,
        updatedAt: outcome.createdAt,
      };
    }

    if (activity) {
      return {
        id: activity.id,
        name: activity.name,
        description: '',
        type: "activity" as const,
        scope: "GLOBAL" as const,
        status: "ACTIVE" as const,
        category: activity.category || null,
        frequency: activity.frequency || null,
        targetValue: null as number | null,
        metricSchema: [],
        usedByTenantsCount: 0,
        createdAt: activity.createdAt,
        updatedAt: activity.createdAt,
      };
    }

    throw new NotFoundException("Template not found");
  }

  async updateTemplateAuto(id: string, dto: { 
    name?: string; 
    description?: string; 
    scope?: string; 
    status?: string;
    category?: string;
    frequency?: string;
    targetValue?: number;
  }) {
    // Try to find in all template tables
    const [metric, outcome, activity] = await Promise.all([
      this.prisma.metricTemplate.findUnique({ where: { id } }),
      this.prisma.outcomeTemplate.findUnique({ where: { id } }),
      this.prisma.activityTemplate.findUnique({ where: { id } }),
    ]);

    if (metric) {
      await this.prisma.metricTemplate.update({
        where: { id },
        data: { 
          name: dto.name,
          frequency: dto.frequency,
          targetValue: dto.targetValue,
        },
      });
      return this.getTemplateByIdAuto(id);
    }

    if (outcome) {
      await this.prisma.outcomeTemplate.update({
        where: { id },
        data: { 
          title: dto.name,
          description: dto.description,
        },
      });
      return this.getTemplateByIdAuto(id);
    }

    if (activity) {
      await this.prisma.activityTemplate.update({
        where: { id },
        data: { 
          name: dto.name,
          category: dto.category,
          frequency: dto.frequency,
        },
      });
      return this.getTemplateByIdAuto(id);
    }

    throw new NotFoundException("Template not found");
  }

  async deleteTemplateAuto(id: string) {
    // Try to find and delete from all template tables
    const [metric, outcome, activity] = await Promise.all([
      this.prisma.metricTemplate.findUnique({ where: { id } }),
      this.prisma.outcomeTemplate.findUnique({ where: { id } }),
      this.prisma.activityTemplate.findUnique({ where: { id } }),
    ]);

    if (metric) {
      await this.prisma.metricTemplate.delete({ where: { id } });
      return { message: "Template deleted successfully" };
    }

    if (outcome) {
      await this.prisma.outcomeTemplate.delete({ where: { id } });
      return { message: "Template deleted successfully" };
    }

    if (activity) {
      await this.prisma.activityTemplate.delete({ where: { id } });
      return { message: "Template deleted successfully" };
    }

    throw new NotFoundException("Template not found");
  }

  async getTemplateById(id: string, type: string) {
    if (type === "metric") {
      const template = await this.prisma.metricTemplate.findUnique({ where: { id } });
      if (!template) throw new NotFoundException("Template not found");
      return {
        id: template.id,
        name: template.name,
        type: "metric",
        targetValue: template.targetValue,
        frequency: template.frequency,
        createdAt: template.createdAt,
      };
    }
    if (type === "outcome") {
      const template = await this.prisma.outcomeTemplate.findUnique({ where: { id } });
      if (!template) throw new NotFoundException("Template not found");
      return {
        id: template.id,
        name: template.title,
        type: "outcome",
        description: template.description,
        createdAt: template.createdAt,
      };
    }
    if (type === "activity") {
      const template = await this.prisma.activityTemplate.findUnique({ where: { id } });
      if (!template) throw new NotFoundException("Template not found");
      return {
        id: template.id,
        name: template.name,
        type: "activity",
        category: template.category,
        frequency: template.frequency,
        createdAt: template.createdAt,
      };
    }
    throw new BadRequestException("Invalid template type");
  }

  async createTemplate(dto: {
    name: string;
    type: string;
    targetValue?: number;
    frequency?: string;
    description?: string;
    category?: string;
  }) {
    if (dto.type === "metric") {
      const template = await this.prisma.metricTemplate.create({
        data: {
          name: dto.name,
          targetValue: dto.targetValue,
          frequency: dto.frequency,
        },
      });
      return { id: template.id, name: template.name, type: "metric" };
    }
    if (dto.type === "outcome") {
      const template = await this.prisma.outcomeTemplate.create({
        data: {
          title: dto.name,
          description: dto.description,
        },
      });
      return { id: template.id, name: template.title, type: "outcome" };
    }
    if (dto.type === "activity") {
      const template = await this.prisma.activityTemplate.create({
        data: {
          name: dto.name,
          category: dto.category,
          frequency: dto.frequency,
        },
      });
      return { id: template.id, name: template.name, type: "activity" };
    }
    throw new BadRequestException("Invalid template type");
  }

  async updateTemplate(
    id: string,
    type: string,
    dto: {
      name?: string;
      targetValue?: number;
      frequency?: string;
      description?: string;
      category?: string;
    },
  ) {
    if (type === "metric") {
      const template = await this.prisma.metricTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          targetValue: dto.targetValue,
          frequency: dto.frequency,
        },
      });
      return { id: template.id, name: template.name, type: "metric" };
    }
    if (type === "outcome") {
      const template = await this.prisma.outcomeTemplate.update({
        where: { id },
        data: {
          title: dto.name,
          description: dto.description,
        },
      });
      return { id: template.id, name: template.title, type: "outcome" };
    }
    if (type === "activity") {
      const template = await this.prisma.activityTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          frequency: dto.frequency,
        },
      });
      return { id: template.id, name: template.name, type: "activity" };
    }
    throw new BadRequestException("Invalid template type");
  }

  async deleteTemplate(id: string, type: string) {
    if (type === "metric") {
      await this.prisma.metricTemplate.delete({ where: { id } });
    } else if (type === "outcome") {
      await this.prisma.outcomeTemplate.delete({ where: { id } });
    } else if (type === "activity") {
      await this.prisma.activityTemplate.delete({ where: { id } });
    } else {
      throw new BadRequestException("Invalid template type");
    }
    return { message: "Template deleted successfully" };
  }

  // ============================================================================
  // SUPPORT TICKETS
  // ============================================================================

  async getTickets(query: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    tenantId?: string;
  }) {
    // Ensure numeric values with proper defaults
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { status, priority, tenantId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (tenantId) where.tenantId = tenantId;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        user: t.user,
        tenant: t.tenant,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!ticket) throw new NotFoundException("Ticket not found");

    return ticket;
  }

  async updateTicketStatus(id: string, dto: { status: string; adminNote?: string }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        adminNote: dto.adminNote,
      },
    });

    return updated;
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  async getAuditLogs(query: {
    page?: number;
    limit?: number;
    tenantId?: string;
    userId?: string;
    module?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { tenantId, userId, module, action, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (module) where.module = module;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.actionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.actionLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        tenantId: log.tenantId,
        module: log.module,
        action: log.action,
        method: log.method,
        endpoint: log.endpoint,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
        createdAt: log.createdAt,
        // Frontend compatibility fields
        actor: log.userId || 'system',
        eventType: log.action || log.method || 'unknown',
        resource: log.endpoint || log.module || '-',
        timestamp: log.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async getTenantReportSummary(query: {
    tenantId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { tenantId, startDate, endDate } = query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const tenantWhere = tenantId ? { id: tenantId } : undefined;

    const tenants = await this.prisma.tenant.findMany({
      where: tenantWhere,
      include: {
        _count: {
          select: { users: true, metrics: true, outcomes: true, activities: true, reviews: true },
        },
        insights: { select: { momentumScore: true, flags: true, streakCount: true } },
        subscriptions: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    return tenants.map((tenant) => {
      const insight = tenant.insights[0];
      const subscription = tenant.subscriptions[0];

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        status: tenant.status || (tenant.isActive ? "active" : "inactive"),
        subscription: subscription
          ? { plan: subscription.plan, status: subscription.status }
          : null,
        userCount: tenant._count.users,
        metricCount: tenant._count.metrics,
        outcomeCount: tenant._count.outcomes,
        activityCount: tenant._count.activities,
        reviewCount: tenant._count.reviews,
        avgMomentumScore: insight?.momentumScore || 0,
        flags: insight?.flags || "Green",
        streakCount: insight?.streakCount || 0,
        lastActiveAt: tenant.lastActiveAt,
        createdAt: tenant.createdAt,
      };
    });
  }

  // ============================================================================
  // PLATFORM SETTINGS
  // ============================================================================

  async getPlatformSettings() {
    // Return platform-wide settings (could be from a settings table)
    return {
      maintenanceMode: false,
      maxTenantsPerPage: 50,
      defaultTrialDays: 30,
      supportEmail: "support@example.com",
    };
  }

  async updatePlatformSettings(dto: Record<string, any>) {
    // In a real implementation, save to a settings table
    return { message: "Settings updated", ...dto };
  }
}
