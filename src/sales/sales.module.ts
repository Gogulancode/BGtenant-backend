import { Module } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { SalesTargetsService } from "./sales-targets.service";
import { SalesController } from "./sales.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesProspectsController } from "./sales-prospects.controller";
import { SalesProspectsService } from "./sales-prospects.service";

@Module({
  imports: [PrismaModule],
  controllers: [SalesController, SalesProspectsController],
  providers: [SalesService, SalesTargetsService, SalesProspectsService],
  exports: [SalesService, SalesTargetsService, SalesProspectsService],
})
export class SalesModule {}
