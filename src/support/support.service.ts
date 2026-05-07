import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ActionLogService } from "../action-log/action-log.service";
import { CreateTicketDto, UpdateTicketDto } from "./dto/ticket.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";
import {
  PaginationDto,
  createPaginatedResponse,
} from "../common/dto/pagination.dto";

type CurrentUserLike = {
  userId: string;
  tenantId?: string | null;
  role: Role;
};

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private actionLog: ActionLogService,
  ) {}

  async createTicket(
    userId: string,
    tenantId: string | null | undefined,
    dto: CreateTicketDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        tenantId: scopedTenantId,
        subject: dto.subject,
        message: dto.message,
        priority: dto.priority,
      },
    });

    await this.actionLog.record(
      userId,
      scopedTenantId,
      "CREATE_TICKET",
      "support",
      { ticketId: ticket.id, subject: dto.subject },
    );
    return ticket;
  }

  async getAllTickets(
    role: Role,
    tenantId: string | null | undefined,
    pagination?: PaginationDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: any = { tenantId: scopedTenantId };

    // Apply search filter if provided
    if (pagination?.search) {
      where.OR = [
        { subject: { contains: pagination.search, mode: "insensitive" } },
        { message: { contains: pagination.search, mode: "insensitive" } },
      ];
    }

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: pagination?.getOrderBy(
          ["subject", "status", "createdat", "priority"],
          "createdAt",
          "desc",
        ) ?? { createdAt: "desc" },
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 20,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    if (pagination) {
      return createPaginatedResponse(tickets, total, pagination);
    }

    return tickets;
  }

  async getMyTickets(
    userId: string,
    tenantId: string | null | undefined,
    pagination?: PaginationDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: any = { userId, tenantId: scopedTenantId };

    // Apply search filter if provided
    if (pagination?.search) {
      where.OR = [
        { subject: { contains: pagination.search, mode: "insensitive" } },
        { message: { contains: pagination.search, mode: "insensitive" } },
      ];
    }

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: pagination?.getOrderBy(
          ["subject", "status", "createdat", "priority"],
          "createdAt",
          "desc",
        ) ?? { createdAt: "desc" },
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 20,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    if (pagination) {
      return createPaginatedResponse(tickets, total, pagination);
    }

    return tickets;
  }

  async updateTicketStatus(
    id: string,
    dto: UpdateTicketDto,
    admin: CurrentUserLike,
  ) {
    const ticket = await this.findScopedTicket(id, admin);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote },
    });

    await this.actionLog.record(
      admin.userId,
      assertTenantContext(admin.tenantId),
      "UPDATE_TICKET_STATUS",
      "support",
      {
        ticketId: id,
        oldStatus: ticket.status,
        newStatus: dto.status,
        note: dto.adminNote,
      },
    );

    return updated;
  }

  async deleteTicket(id: string, admin: CurrentUserLike) {
    await this.findScopedTicket(id, admin);
    await this.prisma.ticket.delete({ where: { id } });
    await this.actionLog.record(
      admin.userId,
      assertTenantContext(admin.tenantId),
      "DELETE_TICKET",
      "support",
      { ticketId: id },
    );
    return { message: "Ticket deleted" };
  }

  private async findScopedTicket(id: string, user: CurrentUserLike) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const scopedTenantId = assertTenantContext(user.tenantId);
    if (ticket.tenantId !== scopedTenantId) {
      throw new ForbiddenException("Ticket is outside of your tenant");
    }

    return ticket;
  }
}
