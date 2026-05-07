import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesProspectStatus } from "@prisma/client";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateSalesProspectDto,
  SalesProspectQueryDto,
  UpdateSalesProspectDto,
} from "./dto/sales-prospect.dto";

@Injectable()
export class SalesProspectsService {
  constructor(private prisma: PrismaService) {}

  async list(
    userId: string,
    tenantId: string | null | undefined,
    query: SalesProspectQueryDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SalesProspectWhereInput = {
      userId,
      tenantId: scopedTenantId,
      month: query.month,
      status: query.status,
      reason: query.reason,
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { prospectName: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
        { offeringType: { contains: search, mode: "insensitive" } },
        { referralSource: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesProspect.findMany({
        where,
        orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salesProspect.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(
    userId: string,
    tenantId: string | null | undefined,
    dto: CreateSalesProspectDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    return this.prisma.salesProspect.create({
      data: this.toCreateData(userId, scopedTenantId, dto),
    });
  }

  async getById(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const prospect = await this.prisma.salesProspect.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });

    if (!prospect) {
      throw new NotFoundException("Sales prospect not found");
    }

    return prospect;
  }

  async update(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
    dto: UpdateSalesProspectDto,
  ) {
    const existing = await this.getById(userId, tenantId, id);

    return this.prisma.salesProspect.update({
      where: { id: existing.id },
      data: this.toUpdateData(dto),
    });
  }

  async remove(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
  ) {
    const existing = await this.getById(userId, tenantId, id);
    await this.prisma.salesProspect.delete({ where: { id: existing.id } });

    return { deleted: true };
  }

  async summary(
    userId: string,
    tenantId: string | null | undefined,
    month?: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: Prisma.SalesProspectWhereInput = {
      userId,
      tenantId: scopedTenantId,
      month,
    };

    const [pipeline, converted, activeFollowUps, rejectedCount, byStatus] =
      await Promise.all([
      this.prisma.salesProspect.aggregate({
        where,
        _sum: { proposalValue: true },
        _count: true,
      }),
      this.prisma.salesProspect.aggregate({
        where: { ...where, status: SalesProspectStatus.CONVERTED },
        _sum: { proposalValue: true },
        _count: true,
      }),
      this.prisma.salesProspect.count({
        where: {
          ...where,
          status: {
            in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
          },
        },
      }),
      this.prisma.salesProspect.count({
        where: { ...where, status: SalesProspectStatus.REJECTED },
      }),
      this.prisma.salesProspect.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    return {
      totalProspects: pipeline._count,
      pipelineValue: pipeline._sum.proposalValue ?? 0,
      convertedCount: converted._count,
      convertedValue: converted._sum.proposalValue ?? 0,
      activeFollowUps,
      rejectedCount,
      byStatus: byStatus.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
    };
  }

  private toCreateData(
    userId: string,
    tenantId: string,
    dto: CreateSalesProspectDto,
  ): Prisma.SalesProspectUncheckedCreateInput {
    return {
      userId,
      tenantId,
      month: dto.month,
      firstCallAt: this.toDate(dto.firstCallAt),
      prospectName: dto.prospectName,
      mobileNumber: dto.mobileNumber,
      offeringType: dto.offeringType,
      proposalValue: dto.proposalValue,
      referralSource: dto.referralSource,
      lastFollowUpAt: this.toDate(dto.lastFollowUpAt),
      status: dto.status,
      reason: dto.reason,
      remarks: dto.remarks,
    };
  }

  private toUpdateData(
    dto: UpdateSalesProspectDto,
  ): Prisma.SalesProspectUncheckedUpdateInput {
    return {
      month: dto.month,
      firstCallAt: this.toDate(dto.firstCallAt),
      prospectName: dto.prospectName,
      mobileNumber: dto.mobileNumber,
      offeringType: dto.offeringType,
      proposalValue: dto.proposalValue,
      referralSource: dto.referralSource,
      lastFollowUpAt: this.toDate(dto.lastFollowUpAt),
      status: dto.status,
      reason: dto.reason,
      remarks: dto.remarks,
    };
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }
}
