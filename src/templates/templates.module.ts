import { Module } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * Templates Module - READ-ONLY for Tenants
 *
 * Templates are global resources managed by Superadmin.
 * This module only exposes GET endpoints for tenants.
 */
@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
