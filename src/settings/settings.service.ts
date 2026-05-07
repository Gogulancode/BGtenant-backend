import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { UpdateBusinessSetupChecklistDto } from "./dto/business-setup-checklist.dto";
import { ActionLogService } from "../action-log/action-log.service";

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private actionLog: ActionLogService,
  ) {}

  private get prefRepo() {
    return (this.prisma as any).userPreference;
  }

  async getSettings(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);

    const [user, tenant, preference, subscription] = await this.prisma.$transaction([
      this.prisma.user.findFirst({
        where: { id: userId, tenantId: scopedTenantId },
      }),
      this.prisma.tenant.findUnique({
        where: { id: scopedTenantId },
        select: {
          id: true,
          name: true,
          type: true,
          slug: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prefRepo.findUnique({ where: { userId } }),
      this.prisma.subscription.findFirst({
        where: { tenantId: scopedTenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          plan: true,
          status: true,
          startDate: true,
          endDate: true,
          trialEndsAt: true,
          maxUsers: true,
          maxMetrics: true,
          maxActivities: true,
        },
      }),
    ]);

    if (!user || !tenant) {
      throw new NotFoundException("Tenant settings not found");
    }

    const prefs =
      preference ??
      (await this.prefRepo.create({
        data: { userId, timezone: "UTC" },
      }));

    return {
      user,
      tenant,
      subscription: subscription ?? {
        plan: "FREE",
        status: "TRIAL",
        maxUsers: 5,
        maxMetrics: 10,
        maxActivities: 50,
      },
      preferences: {
        timezone: prefs.timezone,
        notifications: {
          email: prefs.notificationsEmail,
          push: prefs.notificationsPush,
        },
      },
    };
  }

  async updateSettings(
    userId: string,
    tenantId: string | null | undefined,
    dto: UpdateSettingsDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: scopedTenantId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found in tenant");
    }

    await this.prefRepo.upsert({
      where: { userId },
      create: {
        userId,
        timezone: dto.timezone ?? "UTC",
        notificationsEmail: dto.notificationsEmail ?? true,
        notificationsPush: dto.notificationsPush ?? true,
      },
      update: {
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.notificationsEmail !== undefined
          ? { notificationsEmail: dto.notificationsEmail }
          : {}),
        ...(dto.notificationsPush !== undefined
          ? { notificationsPush: dto.notificationsPush }
          : {}),
      },
    });

    await this.actionLog.record(
      userId,
      scopedTenantId,
      "UPDATE_PREFERENCES",
      "settings",
      { ...dto },
    );

    return this.getSettings(userId, tenantId);
  }

  // ============================================
  // BUSINESS SETUP CHECKLIST
  // ============================================

  async getBusinessSetupChecklist(tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);

    let checklist = await this.prisma.businessSetupChecklist.findUnique({
      where: { tenantId: scopedTenantId },
    });

    if (!checklist) {
      // Create default checklist
      checklist = await this.prisma.businessSetupChecklist.create({
        data: { tenantId: scopedTenantId },
      });
    }

    // Calculate completion percentage
    const steps = [
      checklist.uspDefined,
      checklist.menuCardDefined,
      checklist.packagesDefined,
      checklist.customerSegmentDefined,
    ];
    const completedSteps = steps.filter(Boolean).length;
    const completionPercent = Math.round((completedSteps / steps.length) * 100);

    return {
      ...checklist,
      completedSteps,
      totalSteps: steps.length,
      completionPercent,
    };
  }

  async updateBusinessSetupChecklist(
    userId: string,
    tenantId: string | null | undefined,
    dto: UpdateBusinessSetupChecklistDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    const checklist = await this.prisma.businessSetupChecklist.upsert({
      where: { tenantId: scopedTenantId },
      create: {
        tenantId: scopedTenantId,
        ...dto,
      },
      update: dto,
    });

    await this.actionLog.record(
      userId,
      scopedTenantId,
      "UPDATE_BUSINESS_SETUP_CHECKLIST",
      "settings",
      { ...dto },
    );

    // Return with calculated stats
    return this.getBusinessSetupChecklist(tenantId);
  }
}
