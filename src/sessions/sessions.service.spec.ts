import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
  const prisma = {
    refreshToken: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;

  const actionLog = {
    record: jest.fn(),
  } as any;

  let service: SessionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionsService(prisma, actionLog);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns only non-expired active sessions", async () => {
    const now = new Date("2025-03-01T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    prisma.refreshToken.findMany.mockResolvedValue([]);

    await service.getActiveSessions("user-1");

    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revoked: false,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("prevents managers from revoking sessions outside their tenant", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "target-user",
      user: { tenantId: "tenant-a" },
    });

    await expect(
      service.revokeSession("session-1", {
        userId: "manager-1",
        role: Role.MANAGER,
        tenantId: "tenant-b",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it("allows tenant admins to revoke sessions inside their tenant", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "session-2",
      userId: "target-user",
      user: { tenantId: "tenant-a" },
    });

    prisma.refreshToken.update.mockResolvedValue({});

    await service.revokeSession("session-2", {
      userId: "admin-1",
      role: Role.TENANT_ADMIN,
      tenantId: "tenant-a",
    });

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "session-2" },
      data: { revoked: true },
    });
    expect(actionLog.record).toHaveBeenCalledWith(
      "admin-1",
      "tenant-a",
      "REVOKE_SESSION",
      "session-2",
      expect.objectContaining({ targetUserId: "target-user" }),
    );
  });
});
