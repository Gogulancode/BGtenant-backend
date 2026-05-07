import { ConflictException, ForbiddenException } from "@nestjs/common";
import { BusinessType, Role } from "@prisma/client";
import { UserService } from "./user.service";

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

describe("UserService tenant management", () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const emailService = {
    sendTenantInvite: jest.fn(),
  } as any;

  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(prisma, emailService);
  });

  it("lists only users within the tenant scope and filters inactive by default", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.listTenantUsers("tenant-123", { includeInactive: false });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-123",
          isActive: true,
        }),
      }),
    );
  });

  it("prevents inviting a user when the email already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      service.inviteTenantUser("admin-1", "tenant-1", {
        name: "Coach Jane",
        email: "coach@example.com",
        role: Role.MANAGER,
        businessType: BusinessType.Startup,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks admins from changing their own role", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      id: "admin-1",
      tenantId: "tenant-1",
      role: Role.TENANT_ADMIN,
      isActive: true,
    });

    await expect(
      service.updateTenantUserRole("admin-1", "tenant-1", "admin-1", {
        role: Role.MANAGER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
