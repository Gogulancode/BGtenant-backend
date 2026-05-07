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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { SuperadminService } from "./superadmin.service";
import { SuperAdminGuard } from "./guards";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantType, SubscriptionPlan } from "@prisma/client";

@ApiTags("Superadmin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("superadmin")
export class SuperadminController {
  constructor(private readonly service: SuperadminService) {}

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  @Get("dashboard/summary")
  @ApiOperation({ summary: "Get platform dashboard summary" })
  async getDashboardSummary() {
    return this.service.getDashboardSummary();
  }

  // ============================================================================
  // TENANTS
  // ============================================================================

  @Get("tenants")
  @ApiOperation({ summary: "List all tenants with pagination and filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  async getTenants(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("pageSize") pageSize?: number,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
  ) {
    // Accept both 'limit' and 'pageSize' for frontend compatibility
    const actualLimit = limit || pageSize;
    return this.service.getTenants({ page, limit: actualLimit, status, search, sortBy, sortOrder });
  }

  @Post("tenants")
  @ApiOperation({ summary: "Create a new tenant" })
  async createTenant(
    @Body()
    dto: {
      name: string;
      email: string;
      slug?: string;
      type?: TenantType;
      domain?: string;
      adminEmail?: string;
      adminName?: string;
      adminPassword?: string;
      plan?: SubscriptionPlan;
    },
  ) {
    return this.service.createTenant(dto);
  }

  @Get("tenants/:id")
  @ApiOperation({ summary: "Get tenant by ID" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async getTenantById(@Param("id") id: string) {
    return this.service.getTenantById(id);
  }

  @Patch("tenants/:id")
  @ApiOperation({ summary: "Update tenant" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async updateTenant(
    @Param("id") id: string,
    @Body() dto: { name?: string; email?: string; domain?: string; status?: string },
  ) {
    return this.service.updateTenant(id, dto);
  }

  @Delete("tenants/:id")
  @ApiOperation({ summary: "Delete tenant" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async deleteTenant(@Param("id") id: string) {
    return this.service.deleteTenant(id);
  }

  @Patch("tenants/:id/activate")
  @ApiOperation({ summary: "Activate tenant" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async activateTenant(@Param("id") id: string) {
    return this.service.activateTenant(id);
  }

  @Patch("tenants/:id/deactivate")
  @ApiOperation({ summary: "Deactivate tenant" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async deactivateTenant(@Param("id") id: string) {
    return this.service.deactivateTenant(id);
  }

  @Patch("tenants/:id/subscription")
  @ApiOperation({ summary: "Update tenant subscription" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async updateTenantSubscription(
    @Param("id") id: string,
    @Body() dto: { plan: SubscriptionPlan },
  ) {
    return this.service.updateTenantSubscription(id, dto);
  }

  @Post("tenants/:id/reset-password")
  @ApiOperation({ summary: "Reset tenant admin password and return new credentials" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async resetTenantAdminPassword(@Param("id") id: string) {
    return this.service.resetTenantAdminPassword(id);
  }

  @Get("tenants/:id/stats")
  @ApiOperation({ summary: "Get tenant statistics" })
  @ApiParam({ name: "id", description: "Tenant ID" })
  async getTenantStats(@Param("id") id: string) {
    return this.service.getTenantStats(id);
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  @Get("templates")
  @ApiOperation({ summary: "List all global templates" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, type: String })
  @ApiQuery({ name: "scope", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  async getTemplates(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("type") type?: string,
    @Query("scope") scope?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.service.getTemplates({ page, limit, type, scope, status, search });
  }

  @Post("templates")
  @ApiOperation({ summary: "Create a new template" })
  async createTemplate(
    @Body()
    dto: {
      name: string;
      type: string;
      targetValue?: number;
      frequency?: string;
      description?: string;
      category?: string;
    },
  ) {
    return this.service.createTemplate(dto);
  }

  @Get("templates/:id")
  @ApiOperation({ summary: "Get template by ID (auto-detect type)" })
  @ApiParam({ name: "id", description: "Template ID" })
  async getTemplateByIdSimple(@Param("id") id: string) {
    return this.service.getTemplateByIdAuto(id);
  }

  @Patch("templates/:id")
  @ApiOperation({ summary: "Update template by ID (auto-detect type)" })
  @ApiParam({ name: "id", description: "Template ID" })
  async updateTemplateSimple(
    @Param("id") id: string,
    @Body() dto: { name?: string; description?: string; scope?: string; status?: string },
  ) {
    return this.service.updateTemplateAuto(id, dto);
  }

  @Delete("templates/:id")
  @ApiOperation({ summary: "Delete template by ID (auto-detect type)" })
  @ApiParam({ name: "id", description: "Template ID" })
  async deleteTemplateSimple(@Param("id") id: string) {
    return this.service.deleteTemplateAuto(id);
  }

  @Get("templates/:type/:id")
  @ApiOperation({ summary: "Get template by ID and type" })
  @ApiParam({ name: "type", description: "Template type (metric, outcome, activity)" })
  @ApiParam({ name: "id", description: "Template ID" })
  async getTemplateById(@Param("type") type: string, @Param("id") id: string) {
    return this.service.getTemplateById(id, type);
  }

  @Patch("templates/:type/:id")
  @ApiOperation({ summary: "Update template" })
  @ApiParam({ name: "type", description: "Template type" })
  @ApiParam({ name: "id", description: "Template ID" })
  async updateTemplate(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      targetValue?: number;
      frequency?: string;
      description?: string;
      category?: string;
    },
  ) {
    return this.service.updateTemplate(id, type, dto);
  }

  @Delete("templates/:type/:id")
  @ApiOperation({ summary: "Delete template" })
  @ApiParam({ name: "type", description: "Template type" })
  @ApiParam({ name: "id", description: "Template ID" })
  async deleteTemplate(@Param("type") type: string, @Param("id") id: string) {
    return this.service.deleteTemplate(id, type);
  }

  // ============================================================================
  // SUPPORT TICKETS
  // ============================================================================

  @Get("support/tickets")
  @ApiOperation({ summary: "List support tickets" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "priority", required: false, type: String })
  @ApiQuery({ name: "tenantId", required: false, type: String })
  async getTickets(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("pageSize") pageSize?: number,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("tenantId") tenantId?: string,
  ) {
    const actualLimit = limit || pageSize;
    return this.service.getTickets({ page, limit: actualLimit, status, priority, tenantId });
  }

  @Get("support/tickets/:id")
  @ApiOperation({ summary: "Get ticket by ID" })
  @ApiParam({ name: "id", description: "Ticket ID" })
  async getTicketById(@Param("id") id: string) {
    return this.service.getTicketById(id);
  }

  @Patch("support/tickets/:id/status")
  @ApiOperation({ summary: "Update ticket status" })
  @ApiParam({ name: "id", description: "Ticket ID" })
  async updateTicketStatus(
    @Param("id") id: string,
    @Body() dto: { status: string; adminNote?: string },
  ) {
    return this.service.updateTicketStatus(id, dto);
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  @Get("audit/logs")
  @ApiOperation({ summary: "Get audit logs" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "tenantId", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "module", required: false, type: String })
  @ApiQuery({ name: "action", required: false, type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  async getAuditLogs(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("pageSize") pageSize?: number,
    @Query("tenantId") tenantId?: string,
    @Query("userId") userId?: string,
    @Query("module") module?: string,
    @Query("action") action?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getAuditLogs({
      page,
      limit: limit || pageSize,
      tenantId,
      userId,
      module,
      action,
      startDate,
      endDate,
    });
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  @Get("reports/tenants")
  @ApiOperation({ summary: "Get tenant report summary" })
  @ApiQuery({ name: "tenantId", required: false, type: String })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  async getTenantReportSummary(
    @Query("tenantId") tenantId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getTenantReportSummary({ tenantId, startDate, endDate });
  }

  // ============================================================================
  // PLATFORM SETTINGS
  // ============================================================================

  @Get("settings")
  @ApiOperation({ summary: "Get platform settings" })
  async getPlatformSettings() {
    return this.service.getPlatformSettings();
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update platform settings" })
  async updatePlatformSettings(@Body() dto: Record<string, any>) {
    return this.service.updatePlatformSettings(dto);
  }
}
