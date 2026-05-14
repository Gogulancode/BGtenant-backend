import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { getCacheConfig } from "./common/config/cache.config";
import { envValidationSchema } from "./common/config/env.validation";
import { ActionLoggingMiddleware } from "./common/middleware/action-logging.middleware";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { UserModule } from "./user/user.module";
import { BusinessModule } from "./business/business.module";
import { MetricsModule } from "./metrics/metrics.module";
import { OutcomesModule } from "./outcomes/outcomes.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SalesModule } from "./sales/sales.module";
import { ActivitiesModule } from "./activities/activities.module";
import { InsightsModule } from "./insights/insights.module";
import { SettingsModule } from "./settings/settings.module";
import { ActionLogModule } from "./action-log/action-log.module";
import { TemplatesModule } from "./templates/templates.module";
import { SupportModule } from "./support/support.module";
import { ReportsModule } from "./reports/reports.module";
import { PerformanceModule } from "./performance/performance.module";
import { SessionsModule } from "./sessions/sessions.module";
import { OpsModule } from "./ops/ops.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { CoachModule } from "./coach/coach.module";
import { SuperadminModule } from "./superadmin/superadmin.module";
import { HealthModule } from "./health/health.module";
import { TenantThrottlerGuard } from "./common/guards/tenant-throttler.guard";
import { TenantRateLimitService } from "./common/rate-limit/tenant-rate-limit.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // Show all validation errors
        allowUnknown: true, // Allow unknown env vars
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: getCacheConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 20, // 20 requests per minute (global default)
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    BusinessModule,
    MetricsModule,
    OutcomesModule,
    ReviewsModule,
    SalesModule,
    ActivitiesModule,
    InsightsModule,
    SettingsModule,
    ActionLogModule,
    TemplatesModule,
    SupportModule,
    ReportsModule,
    PerformanceModule,
    SessionsModule,
    OpsModule,
    DashboardModule,
    NotificationsModule,
    OnboardingModule,
    CoachModule,
    SuperadminModule,
    HealthModule,
  ],
  providers: [
    TenantRateLimitService,
    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware) // Add correlation ID first
      .forRoutes("*")
      .apply(ActionLoggingMiddleware)
      .forRoutes("*");
  }
}
