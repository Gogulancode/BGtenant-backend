import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";

@Module({
  imports: [PrismaModule, ActionLogModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
