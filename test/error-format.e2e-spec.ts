import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { IsString, MinLength } from "class-validator";
import { HttpExceptionFilter, StandardErrorResponse } from "../src/common/filters/http-exception.filter";

// Test DTO with validation
class TestDto {
  @IsString()
  @MinLength(5, { message: "name must be at least 5 characters" })
  name: string;
}

// Test controller that throws various exceptions
@Controller("test-errors")
class TestErrorController {
  @Get("not-found")
  throwNotFound() {
    throw new NotFoundException("Resource not found");
  }

  @Get("forbidden")
  throwForbidden() {
    throw new ForbiddenException("Access denied");
  }

  @Get("conflict")
  throwConflict() {
    throw new ConflictException("Resource already exists");
  }

  @Get("bad-request")
  throwBadRequest() {
    throw new BadRequestException("Invalid input data");
  }

  @Get("custom-details")
  throwWithDetails() {
    throw new HttpException(
      {
        message: "Custom error with details",
        details: { field: "email", reason: "invalid format" },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  @Get("internal-error")
  throwInternalError() {
    throw new Error("Database connection failed");
  }

  @Post("validation")
  testValidation(@Body() _dto: TestDto) {
    return { success: true };
  }
}

describe("Standardized Error Format (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestErrorController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectStandardFormat = (body: StandardErrorResponse) => {
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("code");
    expect(typeof body.message).toBe("string");
    expect(typeof body.code).toBe("string");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("path");
  };

  describe("HTTP Exception handling", () => {
    it("returns standard format for 404 Not Found", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/not-found")
        .expect(404);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        message: "Resource not found",
        code: "NOT_FOUND",
      });
    });

    it("returns standard format for 403 Forbidden", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/forbidden")
        .expect(403);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        message: "Access denied",
        code: "FORBIDDEN",
      });
    });

    it("returns standard format for 409 Conflict", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/conflict")
        .expect(409);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        message: "Resource already exists",
        code: "CONFLICT",
      });
    });

    it("returns standard format for 400 Bad Request", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/bad-request")
        .expect(400);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid input data",
        code: "BAD_REQUEST",
      });
    });

    it("returns standard format for 422 with custom details", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/custom-details")
        .expect(422);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        message: "Custom error with details",
        code: "UNPROCESSABLE_ENTITY",
        details: { field: "email", reason: "invalid format" },
      });
    });

    it("returns standard format for 500 Internal Error", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/internal-error")
        .expect(500);

      expectStandardFormat(response.body);
      expect(response.body).toMatchObject({
        success: false,
        code: "INTERNAL_ERROR",
      });
      // Message may be masked in production
      expect(response.body.message).toBeDefined();
    });
  });

  describe("Validation error handling", () => {
    it("returns standard format for validation errors", async () => {
      const response = await request(app.getHttpServer())
        .post("/test-errors/validation")
        .send({ name: "ab" }) // Too short
        .expect(400);

      expectStandardFormat(response.body);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("BAD_REQUEST");
      expect(response.body.message).toContain("at least 5 characters");
      // Full validation messages in details array
      expect(response.body.details).toBeInstanceOf(Array);
    });

    it("returns first validation message as main message", async () => {
      const response = await request(app.getHttpServer())
        .post("/test-errors/validation")
        .send({}) // Missing required field
        .expect(400);

      expectStandardFormat(response.body);
      expect(typeof response.body.message).toBe("string");
      // All messages available in details
      expect(response.body.details).toBeInstanceOf(Array);
    });
  });

  describe("Response format consistency", () => {
    it("always includes success: false on errors", async () => {
      const endpoints = [
        { path: "/test-errors/not-found", status: 404 },
        { path: "/test-errors/forbidden", status: 403 },
        { path: "/test-errors/conflict", status: 409 },
        { path: "/test-errors/bad-request", status: 400 },
        { path: "/test-errors/internal-error", status: 500 },
      ];

      for (const { path, status } of endpoints) {
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(status);

        expect(response.body.success).toBe(false);
      }
    });

    it("always includes timestamp in ISO format", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/not-found")
        .expect(404);

      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it("always includes request path", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/not-found")
        .expect(404);

      expect(response.body.path).toBe("/test-errors/not-found");
    });

    it("never includes statusCode in body (use HTTP status)", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/not-found")
        .expect(404);

      expect(response.body).not.toHaveProperty("statusCode");
    });

    it("never includes error field (replaced by code)", async () => {
      const response = await request(app.getHttpServer())
        .get("/test-errors/not-found")
        .expect(404);

      expect(response.body).not.toHaveProperty("error");
    });
  });

  describe("Error code mapping", () => {
    const codeTests = [
      { path: "/test-errors/bad-request", status: 400, code: "BAD_REQUEST" },
      { path: "/test-errors/forbidden", status: 403, code: "FORBIDDEN" },
      { path: "/test-errors/not-found", status: 404, code: "NOT_FOUND" },
      { path: "/test-errors/conflict", status: 409, code: "CONFLICT" },
      {
        path: "/test-errors/custom-details",
        status: 422,
        code: "UNPROCESSABLE_ENTITY",
      },
      {
        path: "/test-errors/internal-error",
        status: 500,
        code: "INTERNAL_ERROR",
      },
    ];

    codeTests.forEach(({ path, status, code }) => {
      it(`maps HTTP ${status} to code ${code}`, async () => {
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(status);

        expect(response.body.code).toBe(code);
      });
    });
  });
});
