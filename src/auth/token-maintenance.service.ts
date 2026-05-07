import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TokensService } from "./tokens.service";
import { TelemetryService } from "../observability/telemetry.service";

@Injectable()
export class TokenMaintenanceService {
  private readonly logger = new Logger(TokenMaintenanceService.name);

  constructor(
    private readonly tokensService: TokensService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupStaleTokens() {
    try {
      const removed = await this.tokensService.cleanupExpiredTokens();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} expired/rotated refresh tokens`);
      }
      await this.telemetry.recordJobSuccess("token-maintenance", { removed });
    } catch (error) {
      await this.telemetry.recordJobFailure(
        "token-maintenance",
        error as Error,
      );
      throw error;
    }
  }
}
