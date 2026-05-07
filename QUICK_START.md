# 🚀 Quick Start: Multi-Tenant Migration

## Prerequisites

- ✅ PostgreSQL running
- ✅ Database backup created
- ✅ Node.js 18+ installed
- ✅ All services stopped

## Migration in 5 Steps

### Step 1: Generate Prisma Migration (2 min)

```bash
cd D:\BGAccountabiityapp

# Generate Prisma client from new schema
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_multi_tenant_support

# Expected output:
# ✓ Generated Prisma Client
# ✓ Applying migration `20251114XXXXXX_add_multi_tenant_support`
# ✓ Migration applied
```

**What this does**:
- Adds `Tenant` table
- Adds `Subscription` table
- Adds `tenantId` columns to all tenant-scoped models
- Updates `Role` enum (ADMIN → TENANT_ADMIN, adds MANAGER, VIEWER)
- Updates `RefreshToken` model (expiresAt, replacedByToken, ip, userAgent)

### Step 2: Run Data Migration (1 min)

```bash
# Run the data migration script
npx ts-node scripts/migrate-to-multi-tenant.ts
```

**What this does**:
- ✅ Creates default tenant ("default-tenant")
- ✅ Creates FREE subscription for default tenant
- ✅ Migrates existing users:
  - SUPER_ADMIN → stays SUPER_ADMIN (no tenant)
  - ADMIN → becomes TENANT_ADMIN (assigned to default tenant)
  - Others → assigned to default tenant
- ✅ Updates all tenant-scoped data (metrics, outcomes, etc.)

**Expected output**:
```
🔄 Starting multi-tenant data migration...

📦 Creating default tenant...
✅ Created tenant: Default Tenant (clx...)

💳 Creating default subscription...
✅ Subscription created

👥 Migrating existing users...
  ✅ admin@example.com → TENANT_ADMIN (tenant: default-tenant)
  ✅ user@example.com → CLIENT (tenant: default-tenant)
✅ Migrated 2 users

📊 Updating tenant-scoped data...
  ✅ 5 business snapshots
  ✅ 12 metrics
  ✅ 8 outcomes
  ... 

🎉 Migration completed successfully!
```

### Step 3: Update Backend Code (5 min)

#### 3.1 Replace Tokens Service

```bash
# Backup old file
mv src/auth/tokens.service.ts src/auth/tokens.service.ts.backup

# Use new file
mv src/auth/tokens-updated.service.ts src/auth/tokens.service.ts
```

#### 3.2 Update app.module.ts

```typescript
// Add this import at top
import { PlatformModule } from './platform/platform.module';

// Add to imports array
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    // ... other existing modules
    PlatformModule,  // ADD THIS LINE
  ],
})
export class AppModule {}
```

#### 3.3 Update JWT Strategy

File: `src/auth/strategies/jwt.strategy.ts`

```typescript
async validate(payload: any) {
  return {
    sub: payload.sub,
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,  // ADD THIS LINE
  };
}
```

#### 3.4 Update Auth Service

File: `src/auth/auth.service.ts`

In both `register()` and `login()` methods:

```typescript
const tokens = await this.tokensService.issueTokens(
  { 
    sub: user.id, 
    email: user.email, 
    role: user.role,
    tenantId: user.tenantId,  // ADD THIS LINE
  },
  ipAddress,
  userAgent,
);
```

#### 3.5 Update Auth Controller

File: `src/auth/auth.controller.ts`

```typescript
import { IpAddress, UserAgent } from '../common/decorators/tenant.decorator';

@Post('register')
async register(
  @Body() registerDto: RegisterDto,
  @IpAddress() ipAddress: string,      // ADD THIS
  @UserAgent() userAgent: string,      // ADD THIS
) {
  return this.authService.register(registerDto, ipAddress, userAgent);
}

@Post('login')
async login(
  @Body() loginDto: LoginDto,
  @IpAddress() ipAddress: string,      // ADD THIS
  @UserAgent() userAgent: string,      // ADD THIS
) {
  return this.authService.login(loginDto, ipAddress, userAgent);
}

@Post('refresh')
async refresh(
  @Body() dto: RefreshTokenDto,
  @IpAddress() ipAddress: string,      // ADD THIS
  @UserAgent() userAgent: string,      // ADD THIS
) {
  return this.authService.refreshTokens(dto, ipAddress, userAgent);
}
```

### Step 4: Add Tenant Scoping (10-15 min per module)

For **each tenant-scoped controller**, apply this pattern:

**Example: MetricsController**

```typescript
// Add imports
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId, UserId } from '../common/decorators/tenant.decorator';

// Add TenantGuard
@UseGuards(JwtAuthGuard, TenantGuard)  // ADD TenantGuard
@Controller('metrics')
export class MetricsController {
  
  @Get()
  async findAll(@TenantId() tenantId: string) {  // Inject tenantId
    return this.metricsService.findAll(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() dto: CreateMetricDto,
  ) {
    return this.metricsService.create(tenantId, userId, dto);
  }
}
```

**Example: MetricsService**

```typescript
async findAll(tenantId: string) {
  return this.prisma.metric.findMany({
    where: { tenantId },  // Always filter by tenant
    include: { logs: true },
  });
}

async create(tenantId: string, userId: string, dto: CreateMetricDto) {
  return this.prisma.metric.create({
    data: {
      ...dto,
      userId,
      tenantId,  // Always set tenantId
    },
  });
}
```

**Apply to these modules**:
1. ✅ business
2. ✅ metrics
3. ✅ outcomes
4. ✅ reviews
5. ✅ sales
6. ✅ activities
7. ✅ insights
8. ✅ settings (user profile)

### Step 5: Test (10 min)

#### 5.1 Start Backend

```bash
npm run start:dev
```

#### 5.2 Test Registration

```bash
# Register new user (will be assigned to default tenant)
curl -X POST http://localhost:3002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User",
    "businessType": "Startup"
  }'
```

#### 5.3 Test Login & Check JWT

```bash
# Login
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Decode JWT at jwt.io - should see:
# {
#   "sub": "...",
#   "email": "test@example.com",
#   "role": "CLIENT",
#   "tenantId": "clx..."  ← Should be present
# }
```

#### 5.4 Create Super Admin (Manual)

```bash
# Option 1: Via SQL
psql -d bg_accountability

UPDATE "User" 
SET role = 'SUPER_ADMIN', "tenantId" = NULL 
WHERE email = 'admin@bg.com';

# Option 2: Register then update
# 1. Register normally
# 2. Run UPDATE query above
```

#### 5.5 Test Platform Endpoints

```bash
# Login as SUPER_ADMIN
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bg.com",
    "password": "YourPassword"
  }'

# Create a new tenant (use SUPER_ADMIN token)
curl -X POST http://localhost:3002/api/v1/platform/tenants \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "type": "COMPANY",
    "slug": "acme-corp",
    "adminEmail": "admin@acme.com",
    "adminName": "Acme Admin",
    "adminPassword": "SecurePass123!"
  }'

# List all tenants
curl -X GET http://localhost:3002/api/v1/platform/tenants \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

#### 5.6 Test Tenant Isolation

```bash
# 1. Login as Tenant A user
# 2. Try to access metrics
# 3. Should only see Tenant A metrics

# 4. Login as Tenant B user
# 5. Try to access metrics
# 6. Should only see Tenant B metrics (not Tenant A)
```

---

## Common Issues & Fixes

### Issue: "Property 'tenant' does not exist on type 'PrismaService'"

**Solution**: Run `npx prisma generate` again

### Issue: Migration fails with "column already exists"

**Solution**: Database might already be partially migrated. Check:
```bash
npx prisma migrate status
```

### Issue: JWT doesn't include tenantId

**Solution**: Check JWT strategy validation method includes tenantId

### Issue: Users can see other tenants' data

**Solution**: 
1. Verify `TenantGuard` is applied to controller
2. Verify service methods filter by `tenantId`
3. Check database - data should have `tenantId` set

---

## Rollback

If something goes wrong:

```bash
# 1. Restore database backup
psql -U your_user -d bg_accountability < backup.sql

# 2. Revert code changes
git checkout src/auth/tokens.service.ts
git checkout prisma/schema.prisma

# 3. Regenerate Prisma
npx prisma generate

# 4. Restart
npm run start:dev
```

---

## Success Checklist

- [ ] Prisma migration applied successfully
- [ ] Data migration script completed
- [ ] Backend code updated (tokens, JWT, auth)
- [ ] All tenant controllers have `TenantGuard`
- [ ] All tenant services filter by `tenantId`
- [ ] Can register new users (assigned to tenant)
- [ ] Can create SUPER_ADMIN
- [ ] SUPER_ADMIN can access `/platform/tenants`
- [ ] Tenant users CANNOT access `/platform/*`
- [ ] Tenant users can only see their tenant's data
- [ ] JWT includes `tenantId`
- [ ] Token refresh works

---

## Next Steps

1. **Update Frontend**
   - Store `tenantId` from JWT
   - Update API calls if needed
   - Add tenant name to UI header

2. **Implement Remaining Platform Features**
   - Subscriptions module
   - Platform analytics
   - Billing integration

3. **Add Advanced Features**
   - Rate limiting per tenant
   - Redis caching per tenant
   - SSO for enterprise tenants

---

**Estimated Total Time**: 30-45 minutes

**Questions?** See `MULTI_TENANT_MIGRATION.md` for detailed explanations.

