import { Module } from "@nestjs/common";
import { OutcomesService } from "./outcomes.service";
import { OutcomesController } from "./outcomes.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [OutcomesController],
  providers: [OutcomesService],
  exports: [OutcomesService],
})
export class OutcomesModule {}
