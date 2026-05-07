import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
