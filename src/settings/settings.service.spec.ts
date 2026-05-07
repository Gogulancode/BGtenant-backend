import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

const tenantResponse = {
  id: "tenant-1",
  name: "Acme",
  type: "MSME",
  slug: "acme",
  isActive: true,
  createdAt: new Date("2025-01-01"),
};

describe("SettingsService", () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const actionLog = {
    record: jest.fn(),
  } as any;

  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((tasks: Promise<any>[]) =>
      Promise.all(tasks),
    );

    service = new SettingsService(prisma, actionLog);
  });

  it("creates default preferences when none exist", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    prisma.tenant.findUnique.mockResolvedValue(tenantResponse);
    prisma.userPreference.findUnique.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.userPreference.create.mockResolvedValue({
      userId: "user-1",
      timezone: "UTC",
      notificationsEmail: true,
      notificationsPush: true,
    });

    const result = await service.getSettings("user-1", "tenant-1");

    expect(prisma.userPreference.create).toHaveBeenCalledWith({
      data: { userId: "user-1", timezone: "UTC" },
    });
    expect(result.preferences).toEqual({
      timezone: "UTC",
      notifications: { email: true, push: true },
    });
  });

  it("updates preferences, logs action, and returns fresh settings", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    const dto: UpdateSettingsDto = {
      timezone: "America/New_York",
      notificationsEmail: false,
    };

    const getSettingsSpy = jest
      .spyOn(service, "getSettings")
      .mockResolvedValue({
        user: { id: "user-1" },
        tenant: tenantResponse,
        preferences: {
          timezone: "America/New_York",
          notifications: { email: false, push: true },
        },
      } as any);

    await service.updateSettings("user-1", "tenant-1", dto);

    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: {
        userId: "user-1",
        timezone: "America/New_York",
        notificationsEmail: false,
        notificationsPush: true,
      },
      update: {
        timezone: "America/New_York",
        notificationsEmail: false,
      },
    });

    expect(actionLog.record).toHaveBeenCalledWith(
      "user-1",
      "tenant-1",
      "UPDATE_PREFERENCES",
      "settings",
      dto,
    );

    expect(getSettingsSpy).toHaveBeenCalledWith("user-1", "tenant-1");
  });
});
