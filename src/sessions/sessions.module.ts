import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";

@Module({
  imports: [PrismaModule, ActionLogModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
