import { Test, TestingModule } from "@nestjs/testing";
import { TemplatesService } from "../src/templates/templates.service";
import { PrismaService } from "../src/prisma/prisma.service";

interface TemplateRecord {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  createdAt: Date;
}

class InMemoryTemplatePrismaService {
  private metricTemplates: TemplateRecord[] = [];
  private outcomeTemplates: TemplateRecord[] = [];
  private activityTemplates: TemplateRecord[] = [];

  metricTemplate = {
    findMany: async () =>
      [...this.metricTemplates].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
  };

  outcomeTemplate = {
    findMany: async () =>
      [...this.outcomeTemplates].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
  };

  activityTemplate = {
    findMany: async () =>
      [...this.activityTemplates].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
  };

  seedMetrics(records: TemplateRecord[]) {
    this.metricTemplates = records.map((record) => ({ ...record }));
  }

  seedOutcomes(records: TemplateRecord[]) {
    this.outcomeTemplates = records.map((record) => ({ ...record }));
  }

  seedActivities(records: TemplateRecord[]) {
    this.activityTemplates = records.map((record) => ({ ...record }));
  }
}

/**
 * Templates Service Tests - READ-ONLY Operations
 *
 * Templates are global resources managed by Superadmin.
 * The tenant TemplatesService only exposes read operations.
 */
describe("TemplatesService (Read-Only)", () => {
  let service: TemplatesService;
  let prisma: InMemoryTemplatePrismaService;

  beforeEach(async () => {
    prisma = new InMemoryTemplatePrismaService();

    prisma.seedMetrics([
      { id: "mt-1", name: "Weekly Leads", createdAt: new Date("2025-11-01") },
      { id: "mt-2", name: "Monthly Revenue", createdAt: new Date("2025-11-05") },
    ]);

    prisma.seedOutcomes([
      { id: "ot-1", title: "Launch Product", createdAt: new Date("2025-11-01") },
      { id: "ot-2", title: "Hire Team", createdAt: new Date("2025-11-05") },
    ]);

    prisma.seedActivities([
      { id: "at-1", name: "Customer Calls", category: "Sales", createdAt: new Date("2025-11-01") },
    ]);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TemplatesService);
  });

  describe("Metric Templates", () => {
    it("returns all metric templates sorted by createdAt desc", async () => {
      const templates = await service.getAllMetricTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe("Monthly Revenue"); // Most recent first
      expect(templates[1].name).toBe("Weekly Leads");
    });
  });

  describe("Outcome Templates", () => {
    it("returns all outcome templates sorted by createdAt desc", async () => {
      const templates = await service.getAllOutcomeTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].title).toBe("Hire Team"); // Most recent first
      expect(templates[1].title).toBe("Launch Product");
    });
  });

  describe("Activity Templates", () => {
    it("returns all activity templates sorted by createdAt desc", async () => {
      const templates = await service.getAllActivityTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0]).toMatchObject({
        id: "at-1",
        name: "Customer Calls",
        category: "Sales",
      });
    });
  });

  describe("Service has no CRUD methods", () => {
    it("does not expose createMetricTemplate", () => {
      expect((service as any).createMetricTemplate).toBeUndefined();
    });

    it("does not expose updateMetricTemplate", () => {
      expect((service as any).updateMetricTemplate).toBeUndefined();
    });

    it("does not expose deleteMetricTemplate", () => {
      expect((service as any).deleteMetricTemplate).toBeUndefined();
    });

    it("does not expose createOutcomeTemplate", () => {
      expect((service as any).createOutcomeTemplate).toBeUndefined();
    });

    it("does not expose updateOutcomeTemplate", () => {
      expect((service as any).updateOutcomeTemplate).toBeUndefined();
    });

    it("does not expose deleteOutcomeTemplate", () => {
      expect((service as any).deleteOutcomeTemplate).toBeUndefined();
    });

    it("does not expose createActivityTemplate", () => {
      expect((service as any).createActivityTemplate).toBeUndefined();
    });

    it("does not expose updateActivityTemplate", () => {
      expect((service as any).updateActivityTemplate).toBeUndefined();
    });

    it("does not expose deleteActivityTemplate", () => {
      expect((service as any).deleteActivityTemplate).toBeUndefined();
    });
  });
});
