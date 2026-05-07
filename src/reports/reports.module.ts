import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReportDigestService } from "./report-digest.service";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [
    PrismaModule,
    ActionLogModule,
    NotificationsModule,
    ObservabilityModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportDigestService],
})
export class ReportsModule {}
