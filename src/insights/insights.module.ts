import { Module } from "@nestjs/common";
import { InsightsService } from "./insights.service";
import { InsightsController } from "./insights.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ObservabilityModule } from "../observability/observability.module";
import { InsightsCronService } from "./insights.cron";
import { SalesModule } from "../sales/sales.module";
import { ActivitiesModule } from "../activities/activities.module";
import { OutcomesModule } from "../outcomes/outcomes.module";

@Module({
  imports: [
    PrismaModule,
    ObservabilityModule,
    SalesModule,
    ActivitiesModule,
    OutcomesModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsCronService],
  exports: [InsightsService],
})
export class InsightsModule {}
