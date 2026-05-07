import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SnapshotDto } from "./dto/snapshot.dto";
import { BusinessType } from "@prisma/client";
import { assertTenantContext } from "../common/utils/tenant.utils";

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async upsertSnapshot(
    userId: string,
    tenantId: string | null | undefined,
    snapshotDto: SnapshotDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: scopedTenantId },
      select: { businessType: true, tenantId: true },
    });

    if (!user) {
      throw new NotFoundException("User not found in tenant");
    }

    const suggestedNSM = this.suggestNSM(snapshotDto, user.businessType);

    return this.prisma.businessSnapshot.upsert({
      where: { userId },
      update: { ...snapshotDto, suggestedNSM, tenantId: scopedTenantId },
      create: {
        userId,
        tenantId: scopedTenantId,
        ...snapshotDto,
        suggestedNSM,
      },
    });
  }

  async getSnapshot(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.businessSnapshot.findFirst({
      where: { userId, tenantId: scopedTenantId },
    });
  }

  async getNSM(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const snapshot = await this.prisma.businessSnapshot.findFirst({
      where: { userId, tenantId: scopedTenantId },
    });

    if (!snapshot) {
      return { suggestedNSM: "Monthly Revenue" };
    }

    return { suggestedNSM: snapshot.suggestedNSM };
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const snapshot = await this.prisma.businessSnapshot.findFirst({
      where: { userId, tenantId: scopedTenantId },
      select: {
        id: true,
        annualSales: true,
        avgMonthlySales: true,
        ordersPerMonth: true,
        avgSellingPrice: true,
        monthlyExpenses: true,
        profitMargin: true,
        suggestedNSM: true,
      },
    });

    const snapshotFields: (keyof SnapshotDto)[] = [
      "annualSales",
      "avgMonthlySales",
      "ordersPerMonth",
      "avgSellingPrice",
      "monthlyExpenses",
      "profitMargin",
    ];

    if (!snapshot) {
      return {
        hasSnapshot: false,
        completionPercent: 0,
        missingFields: snapshotFields,
        suggestedNSM: "Monthly Revenue",
        snapshot: null,
      };
    }

    const filled = snapshotFields.filter(
      (field) => snapshot[field] !== null && snapshot[field] !== undefined,
    ).length;
    const completionPercent = Number(
      ((filled / snapshotFields.length) * 100).toFixed(2),
    );
    const missingFields = snapshotFields.filter(
      (field) => snapshot[field] === null || snapshot[field] === undefined,
    );

    return {
      hasSnapshot: true,
      completionPercent,
      missingFields,
      suggestedNSM: snapshot.suggestedNSM ?? "Monthly Revenue",
      snapshot,
    };
  }

  private suggestNSM(
    snapshot: SnapshotDto,
    businessType: BusinessType,
  ): string {
    if (businessType === BusinessType.Solopreneur) {
      return "Monthly Revenue";
    }

    if (
      businessType === BusinessType.Startup &&
      (snapshot.ordersPerMonth ?? 0) > 100
    ) {
      return "Active Customers";
    }

    if (
      businessType === BusinessType.MSME &&
      (snapshot.profitMargin ?? 100) < 20
    ) {
      return "Net Profit";
    }

    return "Monthly Revenue";
  }
}
