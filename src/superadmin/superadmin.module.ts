import { Module } from "@nestjs/common";
import { SuperadminController } from "./superadmin.controller";
import { SuperadminService } from "./superadmin.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";

/**
 * SuperadminModule provides platform-level management endpoints.
 * 
 * All endpoints require SUPER_ADMIN role and are protected by SuperAdminGuard.
 * 
 * Endpoints:
 * - GET    /superadmin/dashboard/summary - Platform dashboard stats
 * - GET    /superadmin/tenants           - List tenants (paginated)
 * - POST   /superadmin/tenants           - Create tenant
 * - GET    /superadmin/tenants/:id       - Get tenant by ID
 * - PATCH  /superadmin/tenants/:id       - Update tenant
 * - DELETE /superadmin/tenants/:id       - Delete (suspend) tenant
 * - PATCH  /superadmin/tenants/:id/activate     - Activate tenant
 * - PATCH  /superadmin/tenants/:id/deactivate   - Deactivate tenant
 * - PATCH  /superadmin/tenants/:id/subscription - Update subscription
 * - GET    /superadmin/tenants/:id/stats        - Get tenant stats
 * - GET    /superadmin/templates         - List templates
 * - POST   /superadmin/templates         - Create template
 * - GET    /superadmin/templates/:id     - Get template
 * - PATCH  /superadmin/templates/:id     - Update template
 * - DELETE /superadmin/templates/:id     - Delete template
 * - GET    /superadmin/support           - List support tickets
 * - GET    /superadmin/support/:id       - Get ticket detail
 * - PATCH  /superadmin/support/:id/status - Update ticket status
 * - GET    /superadmin/audit             - Get audit logs
 * - GET    /superadmin/reports/tenant/:id/summary - Tenant report
 */
@Module({
  imports: [PrismaModule, ActionLogModule],
  controllers: [SuperadminController],
  providers: [SuperadminService],
  exports: [SuperadminService],
})
export class SuperadminModule {}
