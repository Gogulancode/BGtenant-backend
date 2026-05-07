/**
 * OpenAPI/Swagger Spec Generator for Tenant Backend
 *
 * Generates a JSON file of the OpenAPI specification that can be shared
 * with mobile (Flutter) and external clients.
 *
 * Usage: npm run generate:openapi
 * Output: ./docs/tenant-openapi.json
 */

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generateOpenApiSpec() {
  console.log('🔧 Bootstrapping NestJS application...');

  // Create application in standalone mode (no HTTP listener)
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  // Set global prefix to match production
  app.setGlobalPrefix('api/v1');

  // Build Swagger document with same config as main.ts
  const config = new DocumentBuilder()
    .setTitle('BG Accountability Tenant API')
    .setDescription(
      `REST API for the BG Accountability Platform - Tenant Services.

## Overview
This API serves both the Tenant Web Dashboard (Next.js) and Mobile App (Flutter).

## Authentication
All protected endpoints require a valid JWT Bearer token.
- Login via \`POST /api/v1/auth/login\`
- Include token in header: \`Authorization: Bearer <token>\`
- Refresh tokens via \`POST /api/v1/auth/refresh\`

## Multi-Factor Authentication (MFA)
- If MFA is enabled, login returns a \`tempToken\`
- Complete MFA via \`POST /api/v1/auth/mfa/login\` with tempToken + TOTP code

## Rate Limiting
- Default: 100 requests per minute per IP
- Auth endpoints: 10 requests per minute per IP

## Error Format
All errors follow: \`{ success: false, message: string, code?: string, details?: object }\`

## Pagination
Paginated endpoints use: \`{ items: T[], total: number, page: number, pageSize: number }\`
`,
    )
    .setVersion('1.0.0')
    .setContact('BG Accountability', 'https://bridgegaps.app', 'support@bridgegaps.app')
    .setLicense('Proprietary', '')
    .addServer('http://localhost:3002', 'Local Development')
    .addServer('https://api.bridgegaps.app', 'Production')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication & MFA endpoints (public)')
    .addTag('User', 'Tenant user management')
    .addTag('Dashboard', 'Consolidated KPIs and telemetry')
    .addTag('Business', 'Business snapshot & NSM configuration')
    .addTag('Metrics', 'KPI tracking and logging')
    .addTag('Outcomes', 'Weekly goal management')
    .addTag('Reviews', 'Daily and weekly reflections')
    .addTag('Sales', 'Sales planning and tracking')
    .addTag('Activities', 'Task and activity management')
    .addTag('Insights', 'Momentum scoring and analytics')
    .addTag('Settings', 'User preferences')
    .addTag('Templates', 'Metric templates')
    .addTag('Support', 'Support ticket management')
    .addTag('Reports', 'Report generation')
    .addTag('Performance', 'Performance analytics')
    .addTag('Sessions', 'Coaching sessions')
    .addTag('Ops', 'Health and diagnostics')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      return `${controllerKey}_${methodKey}`;
    },
  });

  // Ensure docs directory exists
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    console.log('📁 Created docs/ directory');
  }

  // Write OpenAPI spec to file
  const outputPath = path.join(docsDir, 'tenant-openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

  console.log('✅ OpenAPI specification generated successfully!');
  console.log(`📄 Output: ${outputPath}`);
  console.log(`📊 Paths: ${Object.keys(document.paths).length} endpoints`);
  console.log(`🏷️  Tags: ${document.tags?.length || 0} tags`);

  // Print summary of endpoints by tag
  const endpointsByTag: Record<string, number> = {};
  for (const pathObj of Object.values(document.paths)) {
    for (const method of Object.values(pathObj as Record<string, any>)) {
      if (method.tags) {
        for (const tag of method.tags) {
          endpointsByTag[tag] = (endpointsByTag[tag] || 0) + 1;
        }
      }
    }
  }
  console.log('\n📈 Endpoints by tag:');
  for (const [tag, count] of Object.entries(endpointsByTag).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tag}: ${count}`);
  }

  await app.close();
  console.log('\n🎉 Done!');
}

generateOpenApiSpec().catch((error) => {
  console.error('❌ Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
