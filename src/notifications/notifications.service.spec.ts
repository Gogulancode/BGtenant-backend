import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";

class InMemoryNotificationsPrisma {
  notifications: any[] = [];

  notification = {
    findMany: jest.fn(async ({ where, orderBy, take }: any) => {
      const records = this.notifications
        .filter((item) => {
          const tenantMatches = item.tenantId === where.tenantId;
          const userMatches =
            where.OR?.some((condition: any) =>
              condition.userId === null
                ? item.userId === null
                : item.userId === condition.userId,
            ) ?? true;
          return tenantMatches && userMatches;
        })
        .sort((a, b) =>
          orderBy?.createdAt === "desc"
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime(),
        );
      return typeof take === "number" ? records.slice(0, take) : records;
    }),
    count: jest.fn(async ({ where }: any) =>
      this.notifications.filter((item) => {
        const tenantMatches = item.tenantId === where.tenantId;
        const readMatches =
          where.isRead === undefined ? true : item.isRead === where.isRead;
        const userMatches =
          where.OR?.some((condition: any) =>
            condition.userId === null
              ? item.userId === null
              : item.userId === condition.userId,
          ) ?? true;
        return tenantMatches && readMatches && userMatches;
      }).length,
    ),
    findUnique: jest.fn(async ({ where }: any) =>
      this.notifications.find((item) => item.id === where.id) ?? null,
    ),
    update: jest.fn(async ({ where, data }: any) => {
      const record = this.notifications.find((item) => item.id === where.id);
      Object.assign(record, data);
      return record;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      let count = 0;
      this.notifications = this.notifications.map((item) => {
        const tenantMatches = item.tenantId === where.tenantId;
        const readMatches =
          where.isRead === undefined ? true : item.isRead === where.isRead;
        const userMatches =
          where.OR?.some((condition: any) =>
            condition.userId === null
              ? item.userId === null
              : item.userId === condition.userId,
          ) ?? true;
        if (tenantMatches && readMatches && userMatches) {
          count += 1;
          return { ...item, ...data };
        }
        return item;
      });
      return { count };
    }),
  };

  $transaction = jest.fn(async (operations: Array<Promise<any>>) =>
    Promise.all(operations),
  );
}

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: InMemoryNotificationsPrisma;

  beforeEach(async () => {
    prisma = new InMemoryNotificationsPrisma();
    prisma.notifications = [
      {
        id: "tenant-wide",
        tenantId: "tenant-1",
        userId: null,
        type: "info",
        title: "Weekly rhythm",
        message: "You have 3 actions due today.",
        isRead: false,
        createdAt: new Date("2026-05-11T10:00:00.000Z"),
      },
      {
        id: "user-specific",
        tenantId: "tenant-1",
        userId: "user-1",
        type: "success",
        title: "Sales saved",
        message: "Weekly sales entry was saved.",
        isRead: false,
        createdAt: new Date("2026-05-12T10:00:00.000Z"),
      },
      {
        id: "other-user",
        tenantId: "tenant-1",
        userId: "user-2",
        type: "warning",
        title: "Private",
        message: "Private to another user.",
        isRead: false,
        createdAt: new Date("2026-05-12T11:00:00.000Z"),
      },
    ];

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  it("lists tenant-wide and user-specific notifications with unread count", async () => {
    const result = await service.listForUser("tenant-1", "user-1");

    expect(result.notifications.map((item) => item.id)).toEqual([
      "user-specific",
      "tenant-wide",
    ]);
    expect(result.unreadCount).toBe(2);
  });

  it("marks a scoped notification as read", async () => {
    const result = await service.markRead("tenant-1", "user-1", "user-specific");

    expect(result.isRead).toBe(true);
    expect(result.readAt).toBeInstanceOf(Date);
  });

  it("blocks marking another user's notification as read", async () => {
    await expect(
      service.markRead("tenant-1", "user-1", "other-user"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws not found for missing notifications", async () => {
    await expect(
      service.markRead("tenant-1", "user-1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("marks all scoped unread notifications as read", async () => {
    const result = await service.markAllRead("tenant-1", "user-1");

    expect(result.count).toBe(2);
    expect(prisma.notifications.find((item) => item.id === "other-user")?.isRead).toBe(false);
  });
});
