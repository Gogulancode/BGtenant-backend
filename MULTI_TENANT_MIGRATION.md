# 🚀 Multi-Tenant SaaS Migration Guide

## Overview
This document guides you through migrating the BG Accountability Platform to a production-grade multi-tenant SaaS architecture.

## ⚠️ CRITICAL: Read Before Starting

This migration:
- **Adds new Prisma models** (Tenant, Subscription)
- **Updates existing models** with tenantId foreign keys
- **Changes the Role enum** (ADMIN → TENANT_ADMIN, adds new roles)
- **Requires data migration** for existing users
- **Will cause breaking changes** to existing API endpoints

**Estimated Time**: 2-3 hours  
**Risk Level**: HIGH (requires database backup)

---

## Pre-Migration Checklist

### 1. Backup Database
```bash
# PostgreSQL backup
pg_dump -U your_username -d bg_accountability > backup_$(date +%Y%m%d_%H%M%S).sql

# Alternative: Use Prisma
npx prisma db pull
```

### 2. Stop All Services
```bash
# Stop backend
# Stop any cron jobs
# Notify users of maintenance window
```

### 3. Review Current Data
```sql
-- Check existing users
SELECT id, email, role FROM "User";

-- Check data volumes
SELECT 
  (SELECT COUNT(*) FROM "User") as users,
  (SELECT COUNT(*) FROM "Metric") as metrics,
  (SELECT COUNT(*) FROM "Outcome") as outcomes;
```

---

## Migration Steps

### Step 1: Generate Prisma Migration

The updated `schema.prisma` file has been created with:
- ✅ Tenant model
- ✅ Subscription model  
- ✅ Updated User model with tenantId
- ✅ All tenant-scoped models updated
- ✅ New Role enum (TENANT_ADMIN, MANAGER, VIEWER)

```bash
cd D:\BGAccountabiityapp

# Generate Prisma client with new schema
npx prisma generate

# Create migration
npx prisma migrate dev --name add_multi_tenant_support

# This will:
# 1. Add Tenant table
# 2. Add Subscription table
# 3. Add tenantId to User (nullable)
# 4. Add tenantId to all tenant-scoped models
# 5. Update Role enum
# 6. Update RefreshToken model (add expiresAt, replacedByToken, ip, userAgent)
```

⚠️ **EXPECTED WARNINGS**:
- "You are about to add a required column `tenantId` to models without a default value"
- This is OK because we'll handle data migration separately

### Step 2: Data Migration Script

After Prisma migration, run this data migration:

```typescript
// scripts/migrate-to-multi-tenant.ts

import { PrismaClient, Role } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function migrateToMultiTenant() {
  console.log('🔄 Starting multi-tenant data migration...\n');

  // 1. Create default tenant for existing data
  console.log('📦 Creating default tenant...');
  const defaultTenant = await prisma.tenant.create({
    data: {
      name: 'Legacy Tenant',
      type: 'COMPANY',
      slug: 'legacy-tenant',
      isActive: true,
    },
  });
  console.log(`✅ Created tenant: ${defaultTenant.name} (${defaultTenant.id})\n`);

  // 2. Create default subscription
  console.log('💳 Creating default subscription...');
  await prisma.subscription.create({
    data: {
      tenantId: defaultTenant.id,
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      maxUsers: 100,
      maxMetrics: 100,
      maxActivities: 1000,
    },
  });
  console.log('✅ Subscription created\n');

  // 3. Migrate existing users
  console.log('👥 Migrating existing users...');
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    // Determine new role
    let newRole: Role;
    if (user.role === 'SUPER_ADMIN') {
      newRole = Role.SUPER_ADMIN;
      // Super Admin stays without tenant
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: newRole,
          tenantId: null, // Explicitly null for SUPER_ADMIN
        },
      });
      console.log(`  ✅ ${user.email} → SUPER_ADMIN (no tenant)`);
    } else {
      // Convert ADMIN → TENANT_ADMIN
      if (user.role === 'ADMIN') {
        newRole = Role.TENANT_ADMIN;
      } else {
        newRole = user.role as Role;
      }
      
      // Assign to default tenant
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: newRole,
          tenantId: defaultTenant.id,
        },
      });
      console.log(`  ✅ ${user.email} → ${newRole} (tenant: ${defaultTenant.slug})`);
    }
  }
  console.log(`\n✅ Migrated ${users.length} users\n`);

  // 4. Update tenant-scoped models
  console.log('📊 Updating tenant-scoped data...');

  // BusinessSnapshot
  const snapshots = await prisma.businessSnapshot.findMany();
  for (const snapshot of snapshots) {
    await prisma.businessSnapshot.update({
      where: { id: snapshot.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${snapshots.length} business snapshots`);

  // Metrics
  const metrics = await prisma.metric.findMany();
  for (const metric of metrics) {
    await prisma.metric.update({
      where: { id: metric.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${metrics.length} metrics`);

  // Outcomes
  const outcomes = await prisma.outcome.findMany();
  for (const outcome of outcomes) {
    await prisma.outcome.update({
      where: { id: outcome.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${outcomes.length} outcomes`);

  // Reviews
  const reviews = await prisma.review.findMany();
  for (const review of reviews) {
    await prisma.review.update({
      where: { id: review.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${reviews.length} reviews`);

  // Sales Planning
  const salesPlannings = await prisma.salesPlanning.findMany();
  for (const planning of salesPlannings) {
    await prisma.salesPlanning.update({
      where: { id: planning.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${salesPlannings.length} sales plannings`);

  // Sales Tracker
  const salesTrackers = await prisma.salesTracker.findMany();
  for (const tracker of salesTrackers) {
    await prisma.salesTracker.update({
      where: { id: tracker.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${salesTrackers.length} sales trackers`);

  // Activities
  const activities = await prisma.activity.findMany();
  for (const activity of activities) {
    await prisma.activity.update({
      where: { id: activity.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${activities.length} activities`);

  // Insights
  const insights = await prisma.insight.findMany();
  for (const insight of insights) {
    await prisma.insight.update({
      where: { id: insight.id },
      data: { tenantId: defaultTenant.id },
    });
  }
  console.log(`  ✅ ${insights.length} insights`);

  console.log('\n🎉 Migration completed successfully!');
  console.log(`\n📋 Summary:`);
  console.log(`   - Created tenant: ${defaultTenant.slug}`);
  console.log(`   - Migrated ${users.length} users`);
  console.log(`   - Updated all tenant-scoped data`);
  console.log(`\n⚠️  IMPORTANT: Update your frontend to handle tenantId in JWT tokens`);
}

migrateToMultiTenant()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run the migration:**
```bash
npx ts-node scripts/migrate-to-multi-tenant.ts
```

### Step 3: Update app.module.ts

```typescript
// Add to imports array
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    // ... existing imports
    PlatformModule, // ADD THIS
  ],
})
```

### Step 4: Replace tokens.service.ts

```bash
# Backup old file
mv src/auth/tokens.service.ts src/auth/tokens.service.ts.backup

# Rename new file
mv src/auth/tokens-updated.service.ts src/auth/tokens.service.ts
```

### Step 5: Update Auth Service

The `auth.service.ts` needs to:
1. Include `tenantId` in JWT payload
2. Extract IP and User-Agent from requests
3. Handle SUPER_ADMIN vs tenant users

```typescript
// In login() and register()
const tokens = await this.tokensService.issueTokens(
  { 
    sub: user.id, 
    email: user.email, 
    role: user.role,
    tenantId: user.tenantId, // ADD THIS
  },
  ipAddress,
  userAgent,
);
```

### Step 6: Update JWT Strategy

```typescript
// src/auth/strategies/jwt.strategy.ts

async validate(payload: any) {
  return {
    sub: payload.sub,
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId, // ADD THIS
  };
}
```

### Step 7: Add Guards to Controllers

**For Tenant-scoped controllers** (metrics, outcomes, sales, etc.):
```typescript
import { TenantGuard } from '../common/guards/tenant.guard';

@UseGuards(JwtAuthGuard, TenantGuard) // ADD TenantGuard
@Controller('metrics')
export class MetricsController {
  // Inject tenantId in methods
  @Get()
  async findAll(@TenantId() tenantId: string) {
    return this.metricsService.findAll(tenantId);
  }
}
```

**For Platform controllers**:
```typescript
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('platform/tenants')
export class TenantsController {
  // Only SUPER_ADMIN can access
}
```

### Step 8: Update Services to Filter by Tenant

**Example - MetricsService**:
```typescript
async findAll(tenantId: string) {
  return this.prisma.metric.findMany({
    where: { tenantId }, // ADD THIS FILTER
    include: { logs: true },
  });
}

async create(tenantId: string, userId: string, createMetricDto: CreateMetricDto) {
  return this.prisma.metric.create({
    data: {
      ...createMetricDto,
      userId,
      tenantId, // ADD THIS
    },
  });
}
```

**Apply this pattern to ALL tenant-scoped services**:
- business.service.ts
- metrics.service.ts
- outcomes.service.ts
- reviews.service.ts
- sales.service.ts
- activities.service.ts
- insights.service.ts
- settings.service.ts

---

## Testing

### 1. Test SUPER_ADMIN Creation

```bash
# Create Super Admin user
POST /api/v1/auth/register
{
  "email": "superadmin@bg.com",
  "password": "SuperSecure123!",
  "name": "Super Admin",
  "businessType": "MSME"
}

# Then manually update role in database
UPDATE "User" SET role = 'SUPER_ADMIN', "tenantId" = NULL WHERE email = 'superadmin@bg.com';
```

### 2. Test Tenant Creation

```bash
# Login as SUPER_ADMIN
POST /api/v1/auth/login
{
  "email": "superadmin@bg.com",
  "password": "SuperSecure123!"
}

# Create a tenant
POST /api/v1/platform/tenants
Headers: Authorization: Bearer <super_admin_token>
{
  "name": "Acme Corporation",
  "type": "COMPANY",
  "slug": "acme-corp",
  "adminEmail": "admin@acme.com",
  "adminName": "Acme Admin",
  "adminPassword": "SecurePass123!"
}
```

### 3. Test Tenant Isolation

```bash
# Login as Tenant A user
# Try to access Tenant B data
# Should get 403 Forbidden or empty results
```

### 4. Test Platform Access Control

```bash
# Login as regular tenant user
# Try to access /api/v1/platform/tenants
# Should get 403 Forbidden
```

---

## Rollback Plan

If migration fails:

```bash
# 1. Restore database backup
psql -U your_username -d bg_accountability < backup_YYYYMMDD_HHMMSS.sql

# 2. Revert Prisma schema
git checkout HEAD -- prisma/schema.prisma

# 3. Regenerate Prisma client
npx prisma generate

# 4. Restart services
npm run start:dev
```

---

## Post-Migration Tasks

### 1. Update Frontend

- ✅ JWT now includes `tenantId`
- ✅ Store `tenantId` in auth store
- ✅ Update API client to handle new token structure
- ✅ Add tenant switcher (if supporting multi-tenant users)

### 2. Update Documentation

- ✅ API documentation (Swagger)
- ✅ Update README with new architecture
- ✅ Create tenant onboarding guide

### 3. Security Audit

- ✅ Verify all endpoints filter by tenantId
- ✅ Test cross-tenant data access (should fail)
- ✅ Review SUPER_ADMIN permissions
- ✅ Test token refresh flow

### 4. Performance Optimization

- ✅ Add database indexes on tenantId columns
- ✅ Enable query logging to verify tenant filters
- ✅ Load test with multiple tenants

---

## Troubleshooting

### Issue: Prisma generate fails

**Solution**: Make sure PostgreSQL is running and connection string is correct

```bash
# Test connection
npx prisma db pull
```

### Issue: Migration adds nullable tenantId but data exists

**Solution**: The migration script handles this. Run it after Prisma migration.

### Issue: JWT doesn't include tenantId

**Solution**: Check TokensService.issueTokens() includes tenantId in payload

### Issue: Users can see other tenants' data

**Solution**: Verify TenantGuard is applied and services filter by tenantId

---

## Success Criteria

✅ All Prisma migrations run successfully  
✅ All existing users migrated to default tenant  
✅ SUPER_ADMIN can access platform endpoints  
✅ Tenant users can only access their tenant data  
✅ Cross-tenant access is blocked  
✅ JWT tokens include tenantId  
✅ All tests pass  
✅ Swagger documentation updated  

---

## Next Steps After Migration

1. **Implement Subscriptions Module** - Handle billing, plan limits
2. **Add Rate Limiting** - Per tenant and global
3. **Implement Redis Caching** - For tenant data
4. **Add Audit Logging** - Track all tenant actions
5. **Build Admin Portal** - Separate frontend for SUPER_ADMIN
6. **Add Webhooks** - For tenant events
7. **Implement SSO** - For enterprise tenants
8. **Add Analytics** - Platform-wide metrics

---

## Support

If you encounter issues during migration:
1. Check the error logs
2. Verify database state
3. Review this guide's troubleshooting section
4. Have database backup ready for rollback

**Remember**: This is a one-way migration. Test thoroughly in development first!
