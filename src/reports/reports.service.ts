import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role, SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ActionLogService } from "../action-log/action-log.service";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";

type CurrentUserLike = {
  userId: string;
  tenantId?: string | null;
  role: Role;
};

type ActivityTemplate = {
  category?: string;
  priority?: string;
  weeklyGoal?: number;
  reminderDays?: number[];
  measurability?: string;
  impact?: string;
  relevance?: string;
  enabled?: boolean;
};

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private actionLog: ActionLogService,
  ) {}

  async getBusinessProfileReport(requester: CurrentUserLike) {
    const tenantScope = assertTenantContext(requester.tenantId);

    const [
      tenant,
      owner,
      businessIdentity,
      businessSetup,
      salesPlan,
      activityConfiguration,
      prospectGroups,
      nextFollowUps,
      achievementStages,
      businessSnapshot,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantScope },
        select: { id: true, name: true, slug: true, email: true, domain: true },
      }),
      this.prisma.user.findFirst({
        where: { id: requester.userId, tenantId: tenantScope },
        select: {
          id: true,
          name: true,
          email: true,
          businessType: true,
          businessDescription: true,
          socialHandles: true,
          painPoints: true,
        },
      }),
      this.prisma.businessIdentity.findUnique({
        where: { tenantId: tenantScope },
      }),
      this.prisma.businessSetupChecklist.findUnique({
        where: { tenantId: tenantScope },
      }),
      this.prisma.salesPlan.findUnique({
        where: { tenantId: tenantScope },
      }),
      this.prisma.activityConfiguration.findUnique({
        where: { tenantId: tenantScope },
      }),
      this.prisma.salesProspect.groupBy({
        by: ["status"],
        where: { tenantId: tenantScope },
        _count: { _all: true },
        _sum: { proposalValue: true },
      }),
      this.prisma.salesProspect.findMany({
        where: {
          tenantId: tenantScope,
          status: {
            in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
          },
        },
        orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
        take: 5,
        select: {
          prospectName: true,
          status: true,
          proposalValue: true,
          lastFollowUpAt: true,
        },
      }),
      this.prisma.achievementStage.findMany({
        where: { tenantId: tenantScope, isActive: true },
        orderBy: { order: "asc" },
      }),
      this.prisma.businessSnapshot.findFirst({
        where: { tenantId: tenantScope, userId: requester.userId },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    if (!owner) {
      throw new NotFoundException("User not found in your scope");
    }

    const byStatus = prospectGroups.reduce<Record<string, number>>(
      (totals, group) => {
        totals[group.status] = group._count._all;
        return totals;
      },
      {},
    );
    const totalProspects = sum(prospectGroups.map((group) => group._count._all));
    const pipelineValue = sum(
      prospectGroups.map((group) => group._sum.proposalValue),
    );
    const convertedValue = sum(
      prospectGroups
        .filter((group) => group.status === SalesProspectStatus.CONVERTED)
        .map((group) => group._sum.proposalValue),
    );
    const activeFollowUps =
      (byStatus[SalesProspectStatus.WARM] || 0) +
      (byStatus[SalesProspectStatus.HOT] || 0);
    const enabledActivities = toArray<ActivityTemplate>(
      activityConfiguration?.activities,
    ).filter((activity) => activity.enabled !== false);

    await this.actionLog.record(
      requester.userId,
      tenantScope,
      "VIEW_BUSINESS_PROFILE_REPORT",
      "reports",
      { report: "business-profile" },
    );

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
      },
      tenant,
      owner,
      businessIdentity,
      businessSetup,
      salesPlan: salesPlan
        ? {
            ...salesPlan,
            expectedMonthlyRevenue: sum(salesPlan.monthlyTargets),
            expectedMonthlyOrders: sum(salesPlan.monthlyOrderTargets),
            expectedMonthlyLeads: sum(salesPlan.monthlyLeadTargets),
          }
        : null,
      activities: {
        weeklyActivityGoal: activityConfiguration?.weeklyActivityGoal ?? 0,
        enableReminders: activityConfiguration?.enableReminders ?? false,
        reminderDays: activityConfiguration?.reminderDays ?? [],
        enabledActivities,
        totalEnabledWeeklyGoal: sum(
          enabledActivities.map((activity) => activity.weeklyGoal),
        ),
      },
      crm: {
        totalProspects,
        pipelineValue,
        convertedValue,
        activeFollowUps,
        byStatus,
        nextFollowUps,
      },
      achievementStages,
      businessSnapshot,
    };
  }

  async generateReport(dto: GenerateReportDto, requester: CurrentUserLike) {
    const targetUserId = dto.targetUserId ?? requester.userId;
    const tenantScope = assertTenantContext(requester.tenantId);

    if (requester.role === Role.VIEWER && targetUserId !== requester.userId) {
      throw new ForbiddenException(
        "View-only members can only generate their own reports",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: tenantScope,
      },
      include: {
        insight: true,
        metrics: {
          include: { logs: { orderBy: { date: "desc" }, take: 10 } },
        },
        outcomes: { orderBy: { weekStartDate: "desc" }, take: 10 },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found in your scope");
    }

    // Mock PDF generation - in production use pdfkit or puppeteer
    const reportData = {
      user: {
        name: user.name,
        email: user.email,
        businessType: user.businessType,
      },
      type: dto.type,
      generatedAt: new Date().toISOString(),
      insights: {
        momentum: user.insight?.momentumScore || 0,
        flag: user.insight?.flags || "N/A",
        streak: user.insight?.streakCount || 0,
      },
      metrics: user.metrics.map((m) => ({
        name: m.name,
        target: m.target,
        recentLogs: m.logs.slice(0, 5),
      })),
      outcomes: user.outcomes.map((o) => ({
        title: o.title,
        status: o.status,
        weekStart: o.weekStartDate,
      })),
    };

    await this.actionLog.record(
      requester.userId,
      tenantScope,
      "GENERATE_REPORT",
      targetUserId,
      {
        type: dto.type,
      },
    );

    // Return JSON for now - in production, generate actual PDF buffer
    return {
      message: "Report generated successfully",
      data: reportData,
      downloadUrl: "/api/v1/reports/download/" + targetUserId, // Mock
    };
  }
}
