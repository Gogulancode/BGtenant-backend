import { Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";

@Module({
  imports: [PrismaModule, ActionLogModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
