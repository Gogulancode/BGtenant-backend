import { NotFoundException } from "@nestjs/common";
import { SalesProspectReason, SalesProspectStatus } from "@prisma/client";
import { SalesProspectsService } from "./sales-prospects.service";

describe("SalesProspectsService", () => {
  const prisma = {
    salesProspect: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  } as any;

  let service: SalesProspectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesProspectsService(prisma);
  });

  it("lists prospects inside the tenant scope with search and pagination", async () => {
    prisma.salesProspect.findMany.mockResolvedValue([{ id: "prospect-1" }]);
    prisma.salesProspect.count.mockResolvedValue(1);

    const result = await service.list("user-1", "tenant-1", {
      search: "acme",
      page: 1,
      pageSize: 10,
    });

    expect(prisma.salesProspect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          tenantId: "tenant-1",
          OR: expect.any(Array),
        }),
        take: 10,
        skip: 0,
      }),
    );
    expect(result.total).toBe(1);
  });

  it("passes month status and reason filters to list queries", async () => {
    prisma.salesProspect.findMany.mockResolvedValue([{ id: "prospect-1" }]);
    prisma.salesProspect.count.mockResolvedValue(1);

    await service.list("user-1", "tenant-1", {
      month: "2026-05",
      status: SalesProspectStatus.WARM,
      reason: SalesProspectReason.BUDGET,
      page: 2,
      pageSize: 25,
    });

    const expectedWhere = {
      userId: "user-1",
      tenantId: "tenant-1",
      month: "2026-05",
      status: SalesProspectStatus.WARM,
      reason: SalesProspectReason.BUDGET,
    };
    expect(prisma.salesProspect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 25,
        take: 25,
      }),
    );
    expect(prisma.salesProspect.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("creates a tenant-scoped prospect", async () => {
    prisma.salesProspect.create.mockResolvedValue({ id: "prospect-1" });

    const result = await service.create("user-1", "tenant-1", {
      month: "2026-05",
      prospectName: "Acme",
      proposalValue: 1000,
    });

    expect(prisma.salesProspect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tenantId: "tenant-1",
        month: "2026-05",
        prospectName: "Acme",
        proposalValue: 1000,
      }),
    });
    expect(result.id).toBe("prospect-1");
  });

  it("gets a prospect by id inside the tenant and user scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue({
      id: "prospect-1",
      prospectName: "Acme",
    });

    const result = await service.getById("user-1", "tenant-1", "prospect-1");

    expect(prisma.salesProspect.findFirst).toHaveBeenCalledWith({
      where: {
        id: "prospect-1",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    expect(result).toEqual({ id: "prospect-1", prospectName: "Acme" });
  });

  it("updates a prospect after verifying tenant and user scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue({ id: "prospect-1" });
    prisma.salesProspect.update.mockResolvedValue({
      id: "prospect-1",
      status: SalesProspectStatus.HOT,
    });

    const result = await service.update("user-1", "tenant-1", "prospect-1", {
      status: SalesProspectStatus.HOT,
      lastFollowUpAt: "2026-05-10",
    });

    expect(prisma.salesProspect.findFirst).toHaveBeenCalledWith({
      where: {
        id: "prospect-1",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    expect(prisma.salesProspect.update).toHaveBeenCalledWith({
      where: { id: "prospect-1" },
      data: expect.objectContaining({
        status: SalesProspectStatus.HOT,
        lastFollowUpAt: new Date("2026-05-10"),
      }),
    });
    expect(result).toEqual({
      id: "prospect-1",
      status: SalesProspectStatus.HOT,
    });
  });

  it("throws when updating a prospect outside tenant scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue(null);

    await expect(
      service.update("user-1", "tenant-1", "prospect-2", {
        status: SalesProspectStatus.HOT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deletes a prospect after verifying tenant and user scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue({ id: "prospect-1" });
    prisma.salesProspect.delete.mockResolvedValue({ id: "prospect-1" });

    const result = await service.remove("user-1", "tenant-1", "prospect-1");

    expect(prisma.salesProspect.findFirst).toHaveBeenCalledWith({
      where: {
        id: "prospect-1",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    expect(prisma.salesProspect.delete).toHaveBeenCalledWith({
      where: { id: "prospect-1" },
    });
    expect(result).toEqual({ deleted: true });
  });

  it("throws when deleting a prospect outside tenant scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue(null);

    await expect(
      service.remove("user-1", "tenant-1", "prospect-2"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.salesProspect.delete).not.toHaveBeenCalled();
  });

  it("summarizes pipeline converted follow-up and rejected prospects inside the tenant scope", async () => {
    prisma.salesProspect.aggregate
      .mockResolvedValueOnce({ _count: 3, _sum: { proposalValue: 6000 } })
      .mockResolvedValueOnce({ _count: 1, _sum: { proposalValue: 2500 } });
    prisma.salesProspect.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.salesProspect.groupBy.mockResolvedValue([
      { status: SalesProspectStatus.COLD, _count: { status: 1 } },
      { status: SalesProspectStatus.HOT, _count: { status: 1 } },
      { status: SalesProspectStatus.CONVERTED, _count: { status: 1 } },
    ]);

    const result = await service.summary("user-1", "tenant-1", "2026-05");

    expect(prisma.salesProspect.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", tenantId: "tenant-1", month: "2026-05" },
      _sum: { proposalValue: true },
      _count: true,
    });
    expect(prisma.salesProspect.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tenantId: "tenant-1",
        month: "2026-05",
        status: {
          in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
        },
      },
    });
    expect(prisma.salesProspect.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tenantId: "tenant-1",
        month: "2026-05",
        status: SalesProspectStatus.REJECTED,
      },
    });
    expect(result).toEqual({
      totalProspects: 3,
      pipelineValue: 6000,
      convertedCount: 1,
      convertedValue: 2500,
      activeFollowUps: 2,
      rejectedCount: 1,
      byStatus: {
        COLD: 1,
        HOT: 1,
        CONVERTED: 1,
      },
    });
  });
});
