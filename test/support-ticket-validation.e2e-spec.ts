import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { SupportController } from "../src/support/support.controller";
import { SupportService } from "../src/support/support.service";
import { TicketPriority } from "../src/support/dto/ticket.dto";

type ActiveUser = { userId: string; tenantId: string; role: Role };

const authGuardFactory = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

describe("Support Ticket Validation (e2e)", () => {
  let app: INestApplication;
  let supportService: {
    createTicket: jest.Mock;
    getAllTickets: jest.Mock;
    getMyTickets: jest.Mock;
    getTicket: jest.Mock;
    updateTicketStatus: jest.Mock;
    deleteTicket: jest.Mock;
    addTicketComment: jest.Mock;
  };
  let activeUser: ActiveUser;

  beforeEach(async () => {
    activeUser = {
      userId: "user-support-test",
      tenantId: "tenant-support-test",
      role: Role.TENANT_ADMIN,
    };

    supportService = {
      createTicket: jest.fn().mockResolvedValue({
        id: "ticket-1",
        subject: "Valid subject here",
        message: "This is a valid message with enough content.",
        priority: TicketPriority.MEDIUM,
        status: "OPEN",
      }),
      getAllTickets: jest.fn().mockResolvedValue([]),
      getMyTickets: jest.fn().mockResolvedValue([]),
      getTicket: jest.fn().mockResolvedValue({
        id: "ticket-1",
        subject: "Valid subject here",
        message: "This is a valid message with enough content.",
        priority: TicketPriority.MEDIUM,
        status: "OPEN",
        comments: [],
      }),
      updateTicketStatus: jest.fn().mockResolvedValue({ id: "ticket-1" }),
      deleteTicket: jest.fn().mockResolvedValue({ message: "Ticket deleted" }),
      addTicketComment: jest.fn().mockResolvedValue({
        id: "comment-1",
        ticketId: "ticket-1",
        message: "Thanks, I can reproduce this issue now.",
        userId: activeUser.userId,
        userName: "Test User",
        createdAt: new Date().toISOString(),
      }),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        { provide: SupportService, useValue: supportService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardFactory(() => activeUser));

    const moduleRef: TestingModule = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /support/tickets - CreateTicketDto validation", () => {
    describe("subject field", () => {
      it("rejects subject shorter than 5 characters", async () => {
        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Hi",
            message: "This is a valid message description.",
          })
          .expect(400);

        expect(response.body.message).toContain(
          "Subject must be at least 5 characters",
        );
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("rejects subject longer than 120 characters", async () => {
        const longSubject = "A".repeat(121);

        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: longSubject,
            message: "This is a valid message description.",
          })
          .expect(400);

        expect(response.body.message).toContain(
          "Subject must not exceed 120 characters",
        );
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("accepts subject with exactly 5 characters", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Hello",
            message: "This is a valid message description.",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalled();
      });

      it("accepts subject with exactly 120 characters", async () => {
        const maxSubject = "A".repeat(120);

        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: maxSubject,
            message: "This is a valid message description.",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalled();
      });

      it("rejects non-string subject", async () => {
        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: 12345,
            message: "This is a valid message description.",
          })
          .expect(400);

        expect(response.body.message).toBeDefined();
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });
    });

    describe("message field", () => {
      it("rejects message shorter than 10 characters", async () => {
        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "Short",
          })
          .expect(400);

        expect(response.body.message).toContain(
          "Description must be at least 10 characters",
        );
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("rejects message longer than 2000 characters", async () => {
        const longMessage = "A".repeat(2001);

        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: longMessage,
          })
          .expect(400);

        expect(response.body.message).toContain(
          "Description must not exceed 2000 characters",
        );
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("accepts message with exactly 10 characters", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "0123456789",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalled();
      });

      it("accepts message with exactly 2000 characters", async () => {
        const maxMessage = "A".repeat(2000);

        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: maxMessage,
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalled();
      });
    });

    describe("priority field", () => {
      it("accepts LOW priority", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "This is a valid message description.",
            priority: "LOW",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalledWith(
          activeUser.userId,
          activeUser.tenantId,
          expect.objectContaining({ priority: "LOW" }),
        );
      });

      it("accepts MEDIUM priority", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "This is a valid message description.",
            priority: "MEDIUM",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalledWith(
          activeUser.userId,
          activeUser.tenantId,
          expect.objectContaining({ priority: "MEDIUM" }),
        );
      });

      it("accepts HIGH priority", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "This is a valid message description.",
            priority: "HIGH",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalledWith(
          activeUser.userId,
          activeUser.tenantId,
          expect.objectContaining({ priority: "HIGH" }),
        );
      });

      it("rejects invalid priority value", async () => {
        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "This is a valid message description.",
            priority: "URGENT",
          })
          .expect(400);

        expect(response.body.message).toContain(
          "Priority must be LOW, MEDIUM, or HIGH",
        );
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("accepts ticket without priority (optional, defaults to MEDIUM)", async () => {
        await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Valid subject",
            message: "This is a valid message description.",
          })
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalled();
      });
    });

    describe("combined validation", () => {
      it("returns multiple validation errors when multiple fields are invalid", async () => {
        const response = await request(app.getHttpServer())
          .post("/support/tickets")
          .send({
            subject: "Hi",
            message: "Short",
            priority: "CRITICAL",
          })
          .expect(400);

        const messages = Array.isArray(response.body.message)
          ? response.body.message
          : [response.body.message];

        expect(messages.length).toBeGreaterThanOrEqual(2);
        expect(supportService.createTicket).not.toHaveBeenCalled();
      });

      it("accepts valid ticket with all fields", async () => {
        const validTicket = {
          subject: "Dashboard not loading properly",
          message:
            "When I try to access the metrics dashboard, the page shows a loading spinner indefinitely. This started happening after the latest update yesterday.",
          priority: "HIGH",
        };

        await request(app.getHttpServer())
          .post("/support/tickets")
          .send(validTicket)
          .expect(201);

        expect(supportService.createTicket).toHaveBeenCalledWith(
          activeUser.userId,
          activeUser.tenantId,
          expect.objectContaining(validTicket),
        );
      });
    });
  });

  describe("PATCH /support/tickets/:id - UpdateTicketDto validation", () => {
    it("accepts valid status update", async () => {
      await request(app.getHttpServer())
        .patch("/support/tickets/ticket-1")
        .send({ status: "IN_PROGRESS" })
        .expect(200);

      expect(supportService.updateTicketStatus).toHaveBeenCalled();
    });

    it("rejects invalid status value", async () => {
      const response = await request(app.getHttpServer())
        .patch("/support/tickets/ticket-1")
        .send({ status: "PENDING" })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(supportService.updateTicketStatus).not.toHaveBeenCalled();
    });

    it("rejects adminNote longer than 1000 characters", async () => {
      const longNote = "A".repeat(1001);

      const response = await request(app.getHttpServer())
        .patch("/support/tickets/ticket-1")
        .send({ status: "RESOLVED", adminNote: longNote })
        .expect(400);

      expect(response.body.message).toContain(
        "Admin note must not exceed 1000 characters",
      );
      expect(supportService.updateTicketStatus).not.toHaveBeenCalled();
    });

    it("accepts adminNote with exactly 1000 characters", async () => {
      const maxNote = "A".repeat(1000);

      await request(app.getHttpServer())
        .patch("/support/tickets/ticket-1")
        .send({ status: "RESOLVED", adminNote: maxNote })
        .expect(200);

      expect(supportService.updateTicketStatus).toHaveBeenCalled();
    });
  });

  describe("GET /support/tickets/:id - ticket detail", () => {
    it("returns a tenant-scoped support ticket detail", async () => {
      await request(app.getHttpServer())
        .get("/support/tickets/ticket-1")
        .expect(200);

      expect(supportService.getTicket).toHaveBeenCalledWith(
        "ticket-1",
        activeUser,
      );
    });
  });

  describe("POST /support/tickets/:id/comments - AddTicketCommentDto validation", () => {
    it("accepts a valid ticket comment", async () => {
      await request(app.getHttpServer())
        .post("/support/tickets/ticket-1/comments")
        .send({ message: "Thanks, I can reproduce this issue now." })
        .expect(201);

      expect(supportService.addTicketComment).toHaveBeenCalledWith(
        "ticket-1",
        activeUser,
        expect.objectContaining({
          message: "Thanks, I can reproduce this issue now.",
        }),
      );
    });

    it("rejects a blank ticket comment", async () => {
      const response = await request(app.getHttpServer())
        .post("/support/tickets/ticket-1/comments")
        .send({ message: "   " })
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(supportService.addTicketComment).not.toHaveBeenCalled();
    });

    it("rejects ticket comments longer than 1000 characters", async () => {
      const response = await request(app.getHttpServer())
        .post("/support/tickets/ticket-1/comments")
        .send({ message: "A".repeat(1001) })
        .expect(400);

      expect(response.body.message).toContain(
        "Comment must not exceed 1000 characters",
      );
      expect(supportService.addTicketComment).not.toHaveBeenCalled();
    });
  });

  describe("DOS and spam protection", () => {
    it("prevents oversized payloads by rejecting large subjects", async () => {
      const hugeSubject = "A".repeat(10000);

      const response = await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: hugeSubject,
          message: "Valid message content here.",
        })
        .expect(400);

      expect(response.body.message).toContain(
        "Subject must not exceed 120 characters",
      );
    });

    it("prevents oversized payloads by rejecting large messages", async () => {
      const hugeMessage = "A".repeat(100000);

      const response = await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Valid subject",
          message: hugeMessage,
        })
        .expect(400);

      expect(response.body.message).toContain(
        "Description must not exceed 2000 characters",
      );
    });
  });
});
