import { Module } from "@nestjs/common";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionLogModule } from "../action-log/action-log.module";

@Module({
  imports: [PrismaModule, ActionLogModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
