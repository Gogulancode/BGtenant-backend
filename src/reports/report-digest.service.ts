import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { OutcomeStatus, Role } from "@prisma/client";
import { TelemetryService } from "../observability/telemetry.service";

@Injectable()
export class ReportDigestService {
  private readonly logger = new Logger(ReportDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sendDailyDigests() {
    try {
      const activeTenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          users: {
            where: { role: { in: [Role.TENANT_ADMIN, Role.MANAGER] } },
            select: { email: true, name: true, role: true },
            take: 3,
          },
          _count: {
            select: {
              users: true,
              metrics: true,
              outcomes: true,
              activities: true,
            },
          },
        },
      });

      let emailsSent = 0;

      for (const tenant of activeTenants) {
        if (!tenant.users.length) {
          continue;
        }

        const summary = {
          users: tenant._count.users,
          metrics: tenant._count.metrics,
          outcomes: tenant._count.outcomes,
          activities: tenant._count.activities,
        };

        for (const recipient of tenant.users) {
          emailsSent += 1;
          await this.emailService.sendReportDigest({
            tenantName: tenant.name,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            summary,
          });
        }
      }

      this.logger.log(
        `Report digests processed for ${activeTenants.length} active tenants`,
      );

      await this.telemetry.recordJobSuccess("report-digest", {
        tenantsProcessed: activeTenants.length,
        emailsSent,
      });
    } catch (error) {
      await this.telemetry.recordJobFailure("report-digest", error as Error);
      throw error;
    }
  }

  @Cron("0 6 * * 1")
  async sendWeeklyExecutiveDigests() {
    const weekStart = this.getWeekStart();

    try {
      const activeTenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          users: {
            where: { role: { in: [Role.TENANT_ADMIN, Role.MANAGER] } },
            select: { email: true, name: true },
            take: 5,
          },
        },
      });

      let emailsSent = 0;
      for (const tenant of activeTenants) {
        if (!tenant.users.length) {
          continue;
        }

        const [
          outcomes,
          insightAggregate,
          activeUsers,
          openActivities,
          reviews,
          tenantInsights,
        ] = await this.prisma.$transaction([
          this.prisma.outcome.findMany({
            where: {
              tenantId: tenant.id,
              weekStartDate: { gte: weekStart },
            },
            select: { status: true },
          }),
          this.prisma.insight.aggregate({
            where: { tenantId: tenant.id },
            _avg: { momentumScore: true },
            _count: { _all: true },
          }),
          this.prisma.user.count({
            where: { tenantId: tenant.id, isActive: true },
          }),
          this.prisma.activity.count({
            where: {
              tenantId: tenant.id,
              status: "Active",
            },
          }),
          this.prisma.review.count({
            where: {
              tenantId: tenant.id,
              date: { gte: weekStart },
            },
          }),
          this.prisma.insight.findMany({
            where: { tenantId: tenant.id },
            select: { flags: true },
          }),
        ]);

        const completed = outcomes.filter(
          (o) => o.status === OutcomeStatus.Done,
        ).length;
        const planned = outcomes.length;
        const avgMomentum = Number(
          (insightAggregate._avg.momentumScore ?? 0).toFixed(2),
        );

        const flagDistribution = tenantInsights.reduce<Record<string, number>>(
          (acc, group) => {
            const key = group.flags ?? "Unknown";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          },
          {},
        );

        for (const recipient of tenant.users) {
          emailsSent += 1;
          await this.emailService.sendWeeklyExecutiveDigest({
            tenantName: tenant.name,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            windowStart: weekStart.toISOString(),
            kpis: {
              outcomesCompleted: completed,
              outcomesPlanned: planned,
              avgMomentum,
              activeUsers,
              openActivities,
              reviewsSubmitted: reviews,
              flagDistribution,
            },
          });
        }
      }

      await this.telemetry.recordJobSuccess("weekly-executive-digest", {
        tenantsProcessed: activeTenants.length,
        emailsSent,
      });
    } catch (error) {
      await this.telemetry.recordJobFailure(
        "weekly-executive-digest",
        error as Error,
      );
      throw error;
    }
  }

  private getWeekStart(reference = new Date()) {
    const date = new Date(reference);
    const day = date.getDay();
    const diff = (day + 6) % 7; // shift so Monday is start
    date.setDate(date.getDate() - diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
