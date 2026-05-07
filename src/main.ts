import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with specific configuration
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:8080",
      "http://localhost:8081",
      "http://localhost:5173", // Vite default
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Content-Type,Authorization",
  });

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("BG Accountability Tenant API")
    .setDescription(
      "REST API for Tenant Web Dashboard (Next.js) & Mobile (Flutter) clients",
    )
    .setVersion("1.0.0")
    .setContact("BG Accountability", "https://bridgegaps.app", "support@bridgegaps.app")
    .addServer("http://localhost:3002", "Local Development")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT token",
      },
      "JWT-auth",
    )
    .addTag("Auth", "Authentication endpoints (public)")
    .addTag("Auth - MFA", "Multi-factor authentication management")
    .addTag("User", "Tenant user management (TENANT_ADMIN, COACH, SME, etc.)")
    .addTag("Dashboard", "Consolidated tenant KPIs and readiness telemetry")
    .addTag("Business", "Business snapshot & NSM (tenant-scoped)")
    .addTag("Metrics", "KPI tracking (tenant-scoped)")
    .addTag("Outcomes", "Weekly goal management (tenant-scoped)")
    .addTag("Reviews", "Daily/Weekly reflections (tenant-scoped)")
    .addTag("Sales", "Sales planning & tracking (tenant-scoped)")
    .addTag("Activities", "Task management (tenant-scoped)")
    .addTag("Insights", "Momentum & analytics (tenant-scoped)")
    .addTag("Settings", "User preferences (tenant-scoped)")
    .addTag("Templates", "Metric templates (tenant-scoped)")
    .addTag("Support", "Support tickets (tenant-scoped)")
    .addTag("Reports", "Report generation (tenant-scoped)")
    .addTag("Performance", "Performance analytics (tenant-scoped)")
    .addTag("Sessions", "Coaching sessions (tenant-scoped)")
    .addTag("Ops", "Health & diagnostics (public)")
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, doc);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
