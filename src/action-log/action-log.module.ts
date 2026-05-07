import { Module } from "@nestjs/common";
import { ActionLogService } from "./action-log.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ActionLogService],
  exports: [ActionLogService],
})
export class ActionLogModule {}
