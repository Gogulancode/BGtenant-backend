import { Module } from "@nestjs/common";
import { TelemetryService } from "./telemetry.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class ObservabilityModule {}
