import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { TemplatesService } from "./templates.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, UserContext } from "../common/decorators/current-user.decorator";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

const metricTemplateExample = {
  id: "metric_tmpl_123",
  name: "Weekly Qualified Leads",
  description: "Track qualified leads sourced per week",
  unit: "count",
  cadence: "weekly",
  createdAt: "2025-11-15T12:00:00.000Z",
  updatedAt: "2025-11-15T12:05:00.000Z",
};

const outcomeTemplateExample = {
  id: "outcome_tmpl_456",
  title: "Publish customer newsletter",
  category: "Marketing",
  expectedImpact: "Drive engagement",
  createdAt: "2025-11-15T12:00:00.000Z",
  updatedAt: "2025-11-15T12:05:00.000Z",
};

const activityTemplateExample = {
  id: "activity_tmpl_789",
  title: "Follow up with inbound leads",
  category: "Sales",
  defaultOwnerRole: "MANAGER",
  createdAt: "2025-11-15T12:00:00.000Z",
  updatedAt: "2025-11-15T12:05:00.000Z",
};

/**
 * Templates Controller - READ-ONLY for Tenants
 *
 * Templates are global resources managed by Superadmin only.
 * Tenants can view and apply templates but cannot create, update, or delete them.
 *
 * For template management, use the Superadmin API:
 * - POST /superadmin/templates
 * - PATCH /superadmin/templates/:id
 * - DELETE /superadmin/templates/:id
 */
@ApiTags("Templates")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER)
@Controller("templates")
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  // Metric Templates (Read-Only)
  @ApiOperation({
    summary: "Get all metric templates",
    description:
      "Returns all global metric templates. Templates are managed by Superadmin.",
  })
  @ApiOkResponse({
    description: "Ordered list of metric templates",
    schema: { example: [metricTemplateExample] },
  })
  @Get("metrics")
  async getAllMetricTemplates() {
    return this.templatesService.getAllMetricTemplates();
  }

  // Outcome Templates (Read-Only)
  @ApiOperation({
    summary: "Get all outcome templates",
    description:
      "Returns all global outcome templates. Templates are managed by Superadmin.",
  })
  @ApiOkResponse({
    description: "Ordered list of outcome templates",
    schema: { example: [outcomeTemplateExample] },
  })
  @Get("outcomes")
  async getAllOutcomeTemplates() {
    return this.templatesService.getAllOutcomeTemplates();
  }

  // Activity Templates (Read-Only)
  @ApiOperation({
    summary: "Get all activity templates",
    description:
      "Returns all global activity templates. Templates are managed by Superadmin.",
  })
  @ApiOkResponse({
    description: "Ordered list of activity templates",
    schema: { example: [activityTemplateExample] },
  })
  @Get("activities")
  async getAllActivityTemplates() {
    return this.templatesService.getAllActivityTemplates();
  }

  // Apply Metric Template
  @ApiOperation({
    summary: "Apply a metric template",
    description: "Creates a new metric for the user based on the template. Optionally override the target.",
  })
  @ApiCreatedResponse({
    description: "The created metric",
    schema: {
      example: {
        id: "metric_123",
        name: "Daily Sales Calls",
        target: 10,
        createdAt: "2025-11-15T12:00:00.000Z",
      },
    },
  })
  @Post("metrics/:id/apply")
  async applyMetricTemplate(
    @Param("id") templateId: string,
    @CurrentUser() user: UserContext,
    @Body() body: { target?: number },
  ) {
    return this.templatesService.applyMetricTemplate(
      templateId,
      user.userId,
      user.tenantId!,
      body?.target,
    );
  }

  // Apply Outcome Template
  @ApiOperation({
    summary: "Apply an outcome template",
    description: "Creates a new outcome for the user based on the template.",
  })
  @ApiCreatedResponse({
    description: "The created outcome",
    schema: {
      example: {
        id: "outcome_123",
        title: "Close 3 deals",
        status: "Planned",
        createdAt: "2025-11-15T12:00:00.000Z",
      },
    },
  })
  @Post("outcomes/:id/apply")
  async applyOutcomeTemplate(
    @Param("id") templateId: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.templatesService.applyOutcomeTemplate(
      templateId,
      user.userId,
      user.tenantId!,
    );
  }

  // Apply Activity Template
  @ApiOperation({
    summary: "Apply an activity template",
    description: "Creates a new activity for the user based on the template.",
  })
  @ApiCreatedResponse({
    description: "The created activity",
    schema: {
      example: {
        id: "activity_123",
        title: "Follow up with leads",
        category: "Sales",
        status: "Pending",
        createdAt: "2025-11-15T12:00:00.000Z",
      },
    },
  })
  @Post("activities/:id/apply")
  async applyActivityTemplate(
    @Param("id") templateId: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.templatesService.applyActivityTemplate(
      templateId,
      user.userId,
      user.tenantId!,
    );
  }
}
