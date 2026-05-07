import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";

type CurrentUserLike = {
  role: Role;
  tenantId?: string | null;
};

@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService) {}

  async getPerformanceAnalytics(user: CurrentUserLike) {
    const tenantScope = assertTenantContext(user.tenantId);

    // Top leaders (tenant admins & managers) by team momentum
    const leaders = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.TENANT_ADMIN, Role.MANAGER] },
        tenantId: tenantScope,
      },
      include: {
        insight: true,
      },
    });

    const topLeaders = leaders
      .map((leader) => ({
        id: leader.id,
        name: leader.name,
        email: leader.email,
        teamSize: 0, // Placeholder until leader/member relationship exists
        avgMomentum: leader.insight?.momentumScore || 0,
      }))
      .sort((a, b) => b.avgMomentum - a.avgMomentum)
      .slice(0, 10);

    // Top operators (all active tenant members) by momentum
    const allSMEs = await this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER],
        },
        tenantId: tenantScope,
      },
      include: { insight: true },
    });

    const topSMEs = allSMEs
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        businessType: user.businessType,
        momentum: user.insight?.momentumScore || 0,
        flag: user.insight?.flags || "N/A",
        streak: user.insight?.streakCount || 0,
      }))
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 10);

    // Bottom SMEs needing attention
    const bottomSMEs = allSMEs
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        momentum: user.insight?.momentumScore || 0,
        flag: user.insight?.flags || "N/A",
        issues: this.detectIssues(
          user.insight?.momentumScore || 0,
          user.insight?.flags,
        ),
      }))
      .sort((a, b) => a.momentum - b.momentum)
      .slice(0, 10);

    return {
      topCoaches: topLeaders,
      topSMEs,
      bottomSMEs,
      summary: {
        totalCoaches: leaders.length,
        totalSMEs: allSMEs.length,
        avgMomentum:
          allSMEs.reduce((acc, u) => acc + (u.insight?.momentumScore || 0), 0) /
            allSMEs.length || 0,
      },
    };
  }

  private detectIssues(momentum: number, flag: string | null): string[] {
    const issues: string[] = [];
    if (momentum < 40) issues.push("Low momentum score");
    if (flag === "Red") issues.push("Red flag status");
    if (momentum === 0) issues.push("Inactive user");
    return issues;
  }
}
