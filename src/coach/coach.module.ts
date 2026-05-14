import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CoachController } from "./coach.controller";
import { CoachService } from "./coach.service";

@Module({
  imports: [PrismaModule],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
