import { Module } from "@nestjs/common";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";
import { ConfigModule } from "@nestjs/config";
import { ObservabilityModule } from "../observability/observability.module";
import { OpsAuthGuard } from "./guards/ops-auth.guard";

@Module({
  imports: [PrismaModule, ActionLogModule, ConfigModule, ObservabilityModule],
  controllers: [OpsController],
  providers: [OpsService, OpsAuthGuard],
})
export class OpsModule {}
