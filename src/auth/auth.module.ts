import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { TokensService } from "./tokens.service";
import { JwtStrategy } from "../common/strategies/jwt.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { TokenMaintenanceService } from "./token-maintenance.service";
import { RefreshTokenCleanupService } from "./refresh-token-cleanup.service";
import { ObservabilityModule } from "../observability/observability.module";
import { PasswordPolicyService } from "./password-policy.service";
import { MfaService } from "./mfa.service";
import { OnboardingModule } from "../onboarding/onboarding.module";

@Module({
  imports: [
    PrismaModule,
    ObservabilityModule,
    PassportModule,
    OnboardingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "15m" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    JwtStrategy,
    TokenMaintenanceService,
    RefreshTokenCleanupService,
    PasswordPolicyService,
    MfaService,
  ],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
