import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InsightsService } from "./insights.service";

@Injectable()
export class InsightsCronService {
  private readonly logger = new Logger(InsightsCronService.name);

  constructor(private readonly insightsService: InsightsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleTenantRefresh() {
    try {
      await this.insightsService.refreshTenantInsights();
    } catch (error) {
      this.logger.error(
        `Insights cron failed: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }
}
