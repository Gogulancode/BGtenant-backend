import { Module } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { DashboardGuidanceService } from "./dashboard-guidance.service";
import { DashboardController } from "./dashboard.controller";
import { BusinessModule } from "../business/business.module";
import { MetricsModule } from "../metrics/metrics.module";
import { OutcomesModule } from "../outcomes/outcomes.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SalesModule } from "../sales/sales.module";
import { ActivitiesModule } from "../activities/activities.module";
import { InsightsModule } from "../insights/insights.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [
    BusinessModule,
    MetricsModule,
    OutcomesModule,
    ReviewsModule,
    SalesModule,
    ActivitiesModule,
    InsightsModule,
    PrismaModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGuidanceService],
})
export class DashboardModule {}
