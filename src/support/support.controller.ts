import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { SupportService } from "./support.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import {
  TENANT_LEADERSHIP_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import {
  AddTicketCommentDto,
  CreateTicketDto,
  UpdateTicketDto,
} from "./dto/ticket.dto";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("Support")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("support")
export class SupportController {
  constructor(private supportService: SupportService) {}

  @ApiOperation({ summary: "Create support ticket" })
  @ApiCreatedResponse({ description: "Support ticket created" })
  @Post("tickets")
  @Roles(...TENANT_MEMBER_ROLES)
  async createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: UserContext) {
    return this.supportService.createTicket(user.userId, user.tenantId, dto);
  }

  @ApiOperation({ summary: "Get all tickets (Admin only)" })
  @ApiOkResponse({ description: "All tenant tickets" })
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @Get("tickets")
  async getAllTickets(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationDto,
  ) {
    return this.supportService.getAllTickets(user.role, user.tenantId, pagination);
  }

  @ApiOperation({ summary: "Get my tickets" })
  @ApiOkResponse({ description: "Tickets created by current user" })
  @Get("tickets/my")
  @Roles(...TENANT_MEMBER_ROLES)
  async getMyTickets(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationDto,
  ) {
    return this.supportService.getMyTickets(user.userId, user.tenantId, pagination);
  }

  @ApiOperation({ summary: "Get support ticket detail" })
  @ApiOkResponse({ description: "Tenant-scoped ticket detail with comments" })
  @Get("tickets/:id")
  @Roles(...TENANT_MEMBER_ROLES)
  async getTicket(@Param("id") id: string, @CurrentUser() user: UserContext) {
    return this.supportService.getTicket(id, user);
  }

  @ApiOperation({ summary: "Add support ticket comment" })
  @ApiCreatedResponse({ description: "Support ticket comment created" })
  @Post("tickets/:id/comments")
  @Roles(...TENANT_MEMBER_ROLES)
  async addTicketComment(
    @Param("id") id: string,
    @Body() dto: AddTicketCommentDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.supportService.addTicketComment(id, user, dto);
  }

  @ApiOperation({ summary: "Update ticket status (Admin only)" })
  @ApiOkResponse({ description: "Updated ticket" })
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @Patch("tickets/:id")
  async updateTicketStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.supportService.updateTicketStatus(id, dto, user);
  }

  @ApiOperation({ summary: "Delete ticket (Admin only)" })
  @ApiOkResponse({ description: "Ticket deleted" })
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @Delete("tickets/:id")
  async deleteTicket(@Param("id") id: string, @CurrentUser() user: UserContext) {
    return this.supportService.deleteTicket(id, user);
  }
}
