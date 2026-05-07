import { ConfigService } from "@nestjs/config";
import { SubscriptionPlan } from "@prisma/client";
import { TenantRateLimitService } from "./tenant-rate-limit.service";

describe("TenantRateLimitService", () => {
  let service: TenantRateLimitService;
  const prisma = {
    subscription: {
      findFirst: jest.fn(),
    },
  } as any;
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
  } as any;
  const config = {
    get: jest.fn().mockReturnValue(20),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantRateLimitService(prisma, config, cache);
  });

  it("falls back to default limit for anonymous requests", async () => {
    cache.get.mockResolvedValue(undefined);
    prisma.subscription.findFirst.mockResolvedValue(null);
    const limit = await service.getLimitForTenant(null);
    expect(limit).toBe(20);
  });

  it("multiplies limit based on plan", async () => {
    cache.get.mockResolvedValue(undefined);
    prisma.subscription.findFirst.mockResolvedValue({
      plan: SubscriptionPlan.PROFESSIONAL,
    });
    const limit = await service.getLimitForTenant("tenant-123");
    expect(limit).toBe(80);
    expect(cache.set).toHaveBeenCalled();
  });

  it("builds tenant tracker when tenantId present", async () => {
    const tracker = service.buildTracker({
      headers: {},
      user: { tenantId: "tenant-1" },
    });
    expect(tracker).toBe("tenant:tenant-1");
  });
});
