import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import {
  PaginationDto,
  createPaginatedResponse,
} from "../src/common/dto/pagination.dto";

describe("PaginationDto", () => {
  describe("Unit tests", () => {
    it("has correct default values", () => {
      const dto = new PaginationDto();
      expect(dto.page).toBe(1);
      expect(dto.pageSize).toBe(20);
      expect(dto.search).toBeUndefined();
      expect(dto.sort).toBeUndefined();
    });

    it("calculates skip correctly", () => {
      const dto = new PaginationDto();
      dto.page = 1;
      dto.pageSize = 20;
      expect(dto.skip).toBe(0);

      dto.page = 2;
      expect(dto.skip).toBe(20);

      dto.page = 3;
      dto.pageSize = 10;
      expect(dto.skip).toBe(20);
    });

    it("calculates take correctly", () => {
      const dto = new PaginationDto();
      dto.pageSize = 20;
      expect(dto.take).toBe(20);

      dto.pageSize = 50;
      expect(dto.take).toBe(50);
    });

    it("parses sort string correctly", () => {
      const dto = new PaginationDto();
      dto.sort = "createdAt:desc";

      const orderBy = dto.getOrderBy(["createdat", "name"]);
      expect(orderBy).toEqual({ createdat: "desc" });
    });

    it("returns default orderBy for invalid sort", () => {
      const dto = new PaginationDto();
      dto.sort = "invalidField:desc";

      const orderBy = dto.getOrderBy(["createdat", "name"], "createdAt", "asc");
      expect(orderBy).toEqual({ createdAt: "asc" });
    });

    it("returns default orderBy when sort is undefined", () => {
      const dto = new PaginationDto();

      const orderBy = dto.getOrderBy(
        ["createdat", "name"],
        "updatedAt",
        "desc",
      );
      expect(orderBy).toEqual({ updatedAt: "desc" });
    });
  });

  describe("createPaginatedResponse", () => {
    it("creates correct pagination meta for first page", () => {
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 10;

      const result = createPaginatedResponse(
        [{ id: 1 }, { id: 2 }],
        25,
        pagination,
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it("creates correct pagination meta for middle page", () => {
      const pagination = new PaginationDto();
      pagination.page = 2;
      pagination.pageSize = 10;

      const result = createPaginatedResponse(
        [{ id: 11 }, { id: 12 }],
        25,
        pagination,
      );

      expect(result.meta.page).toBe(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it("creates correct pagination meta for last page", () => {
      const pagination = new PaginationDto();
      pagination.page = 3;
      pagination.pageSize = 10;

      const result = createPaginatedResponse(
        [{ id: 21 }, { id: 22 }],
        25,
        pagination,
      );

      expect(result.meta.page).toBe(3);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it("handles empty results", () => {
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 20;

      const result = createPaginatedResponse([], 0, pagination);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });
  });

  describe("Validation (integration)", () => {
    let app: INestApplication;

    beforeAll(async () => {
      const { Controller, Get, Query } = await import("@nestjs/common");

      @Controller("test-pagination")
      class TestController {
        @Get()
        getPaginated(@Query() pagination: PaginationDto) {
          return {
            page: pagination.page,
            pageSize: pagination.pageSize,
            skip: pagination.skip,
            take: pagination.take,
            search: pagination.search,
            sort: pagination.sort,
          };
        }
      }

      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [TestController],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("accepts valid pagination parameters", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ page: 2, pageSize: 50, search: "test", sort: "name:asc" })
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(50);
      expect(response.body.skip).toBe(50);
      expect(response.body.take).toBe(50);
      expect(response.body.search).toBe("test");
      expect(response.body.sort).toBe("name:asc");
    });

    it("uses default values when no params provided", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
      expect(response.body.skip).toBe(0);
    });

    it("rejects page less than 1", async () => {
      await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ page: 0 })
        .expect(400);
    });

    it("rejects pageSize greater than 100", async () => {
      await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ pageSize: 101 })
        .expect(400);
    });

    it("rejects pageSize less than 1", async () => {
      await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ pageSize: 0 })
        .expect(400);
    });

    it("rejects invalid sort format", async () => {
      await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ sort: "invalid" })
        .expect(400);
    });

    it("accepts valid sort format asc", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ sort: "createdAt:asc" })
        .expect(200);

      expect(response.body.sort).toBe("createdAt:asc");
    });

    it("accepts valid sort format desc", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ sort: "updated_at:DESC" })
        .expect(200);

      expect(response.body.sort).toBe("updated_at:DESC");
    });

    it("transforms page and pageSize to integers", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ page: "3", pageSize: "25" })
        .expect(200);

      expect(response.body.page).toBe(3);
      expect(response.body.pageSize).toBe(25);
    });

    it("trims search string", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-pagination")
        .query({ search: "  test query  " })
        .expect(200);

      expect(response.body.search).toBe("test query");
    });
  });
});
