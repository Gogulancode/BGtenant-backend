import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
} from "@nestjs/common";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { ActivitiesController } from "../src/activities/activities.controller";
import { ActivitiesService } from "../src/activities/activities.service";

type ActiveUser = {
  userId: string;
  tenantId: string | null;
  role: Role;
};

const createAuthGuard = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

describe("Activities Filter & Pagination E2E Tests", () => {
  let app: INestApplication;
  let activeUser: ActiveUser;

  const mockActivities = [
    {
      id: "act-1",
      title: "Sales Call",
      category: "Sales",
      status: "Active",
      priority: "High",
      dueDate: new Date("2025-03-15"),
      createdAt: new Date("2025-03-01"),
    },
    {
      id: "act-2",
      title: "Operations Review",
      category: "Operations",
      status: "Completed",
      priority: "Medium",
      dueDate: new Date("2025-03-10"),
      createdAt: new Date("2025-03-02"),
    },
    {
      id: "act-3",
      title: "Lead Follow-up",
      category: "Leads",
      status: "Active",
      priority: "Low",
      dueDate: new Date("2025-03-20"),
      createdAt: new Date("2025-03-03"),
    },
    {
      id: "act-4",
      title: "Quarterly Planning",
      category: "Strategy",
      status: "Active",
      priority: "High",
      dueDate: new Date("2025-04-01"),
      createdAt: new Date("2025-03-04"),
    },
    {
      id: "act-5",
      title: "Team Sync",
      category: "Operations",
      status: "Cancelled",
      priority: "Low",
      dueDate: new Date("2025-03-12"),
      createdAt: new Date("2025-03-05"),
    },
  ];

  const activitiesService = {
    getAllActivities: jest.fn(),
    createActivity: jest.fn(),
    updateActivity: jest.fn(),
    deleteActivity: jest.fn(),
    getSummary: jest.fn(),
  };

  beforeAll(async () => {
    activeUser = {
      userId: "user-activities",
      tenantId: "tenant-activities",
      role: Role.TENANT_ADMIN,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: activitiesService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createAuthGuard(() => activeUser))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    activitiesService.getAllActivities.mockResolvedValue(mockActivities);
  });

  describe("GET /activities - Filtering", () => {
    it("returns all activities without filters", async () => {
      await request(app.getHttpServer())
        .get("/activities")
        .expect(200);

      expect(activitiesService.getAllActivities).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
        expect.any(Object),
      );
    });

    it("accepts category filter parameter", async () => {
      await request(app.getHttpServer())
        .get("/activities?category=Sales")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].category).toBe("Sales");
    });

    it("accepts status filter parameter", async () => {
      await request(app.getHttpServer())
        .get("/activities?status=Active")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].status).toBe("Active");
    });

    it("accepts priority filter parameter", async () => {
      await request(app.getHttpServer())
        .get("/activities?priority=High")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].priority).toBe("High");
    });

    it("accepts date range filter parameters", async () => {
      await request(app.getHttpServer())
        .get("/activities?dueDateFrom=2025-03-01&dueDateTo=2025-03-31")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].dueDateFrom).toBe("2025-03-01");
      expect(callArgs[2].dueDateTo).toBe("2025-03-31");
    });

    it("rejects invalid status value", async () => {
      await request(app.getHttpServer())
        .get("/activities?status=INVALID")
        .expect(400);
    });

    it("rejects invalid priority value", async () => {
      await request(app.getHttpServer())
        .get("/activities?priority=URGENT")
        .expect(400);
    });

    it("rejects invalid date format", async () => {
      await request(app.getHttpServer())
        .get("/activities?dueDateFrom=invalid-date")
        .expect(400);
    });
  });

  describe("GET /activities - Pagination", () => {
    it("accepts page and pageSize parameters", async () => {
      await request(app.getHttpServer())
        .get("/activities?page=2&pageSize=10")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].page).toBe(2);
      expect(callArgs[2].pageSize).toBe(10);
    });

    it("rejects page less than 1", async () => {
      await request(app.getHttpServer())
        .get("/activities?page=0")
        .expect(400);
    });

    it("rejects pageSize greater than 100", async () => {
      await request(app.getHttpServer())
        .get("/activities?pageSize=200")
        .expect(400);
    });

    it("accepts search parameter", async () => {
      await request(app.getHttpServer())
        .get("/activities?search=sales")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].search).toBe("sales");
    });

    it("accepts sort parameter", async () => {
      await request(app.getHttpServer())
        .get("/activities?sort=dueDate:asc")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2].sort).toBe("dueDate:asc");
    });

    it("rejects invalid sort format", async () => {
      await request(app.getHttpServer())
        .get("/activities?sort=invalid")
        .expect(400);
    });
  });

  describe("GET /activities - Combined Filters and Pagination", () => {
    it("accepts multiple filters with pagination", async () => {
      await request(app.getHttpServer())
        .get("/activities?category=Sales&status=Active&priority=High&page=1&pageSize=5&sort=dueDate:desc")
        .expect(200);

      const callArgs = activitiesService.getAllActivities.mock.calls[0];
      expect(callArgs[2]).toMatchObject({
        category: "Sales",
        status: "Active",
        priority: "High",
        page: 1,
        pageSize: 5,
        sort: "dueDate:desc",
      });
    });

    it("returns paginated response structure when pagination is used", async () => {
      const paginatedResponse = {
        data: mockActivities.slice(0, 2),
        meta: {
          page: 1,
          pageSize: 2,
          total: 5,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      };

      activitiesService.getAllActivities.mockResolvedValue(paginatedResponse);

      const response = await request(app.getHttpServer())
        .get("/activities?page=1&pageSize=2&search=activity")
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: expect.objectContaining({
          page: 1,
          pageSize: 2,
          total: 5,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
      });
    });
  });

  describe("Role-based Access", () => {
    it("allows VIEWER role to read activities", async () => {
      activeUser = {
        userId: "viewer-user",
        tenantId: "tenant-activities",
        role: Role.VIEWER,
      };

      await request(app.getHttpServer())
        .get("/activities")
        .expect(200);
    });

    it("allows STAFF role to read activities", async () => {
      activeUser = {
        userId: "staff-user",
        tenantId: "tenant-activities",
        role: Role.STAFF,
      };

      await request(app.getHttpServer())
        .get("/activities")
        .expect(200);
    });
  });
});
