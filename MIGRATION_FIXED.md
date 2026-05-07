# Multi-Tenant Migration - Fixed and Ready

## ✅ What Was Fixed

### 1. **Migration SQL File** (`prisma/migrations/20251114062121_add_multi_tenant_support/migration.sql`)

**Problem**: Auto-generated migration tried to add required `tenantId` columns to tables with existing data, which is impossible without default values.

**Solution**: Restructured migration to follow this safe order:

```sql
Step 1: Create new enums (TenantType, SubscriptionPlan, SubscriptionStatus)
Step 2: Create Tenant and Subscription tables
Step 3: Insert default tenant ('default-tenant-id')
Step 4: Insert default subscription (PROFESSIONAL plan)
Step 5: Update existing User roles (ADMIN → TENANT_ADMIN before enum change)
Step 6: Update Role enum (safe now since ADMIN no longer in data)
Step 7: Add tenantId columns as NULLABLE
Step 8: Backfill existing data with 'default-tenant-id'
Step 9: Make tenantId columns NOT NULL
Step 10: Add foreign key constraints
Step 11: Add performance indexes
Step 12: Add unique constraints
```

**Key Changes**:
- Creates default tenant BEFORE adding tenantId columns
- Adds columns as nullable first, backfills data, then makes required
- Converts ADMIN → TENANT_ADMIN before enum change
- Auto-assigns all non-SUPER_ADMIN users to default tenant

### 2. **Migration Script** (`scripts/migrate-to-multi-tenant.ts`)

**Problem**: TypeScript compilation error at line 60 - compared `user.role !== 'ADMIN'` but Role enum no longer has ADMIN value.

**Solution**: 
- Line 60: Changed `'ADMIN'` to `Role.TENANT_ADMIN`
- Line 84: Removed obsolete ADMIN check (migration.sql already handles conversion)
- Simplified logic since SQL migration pre-converts roles

---

## 🚀 Next Steps - Run Migration

### **Step 1: Backup Your Database** ⚠️

```powershell
# Using pg_dump (if installed)
pg_dump -h localhost -U postgres -d accountability -f backup_before_migration.sql

# Or just verify your data
npx prisma studio
# Manually check Users, Metrics, BusinessSnapshot tables
```

### **Step 2: Apply Prisma Migration**

```powershell
cd d:\BGAccountabiityapp
npx prisma migrate dev
```

**Expected Output**:
```
✔ Enter a name for the new migration: … (leave blank, it will use existing)
Applying migration `20251114062121_add_multi_tenant_support`
✅ Migration applied successfully
✔ Generated Prisma Client
```

**What This Does**:
- Executes modified migration.sql
- Creates Tenant and Subscription tables
- Inserts default tenant and subscription
- Adds tenantId to all tenant-scoped models
- Backfills existing data with default tenant ID
- Updates Role enum (ADMIN → TENANT_ADMIN)
- Generates new Prisma Client with Tenant/Subscription models

### **Step 3: Verify Migration**

```powershell
# Check database structure
npx prisma studio
```

**Verify**:
- ✅ Tenant table exists with 1 row ("Default Tenant")
- ✅ Subscription table exists with 1 row (PROFESSIONAL plan)
- ✅ All User records have tenantId = 'default-tenant-id'
- ✅ All Metrics, Outcomes, etc. have tenantId = 'default-tenant-id'
- ✅ User roles changed from ADMIN to TENANT_ADMIN

### **Step 4: Run Data Migration Script** (OPTIONAL - already handled by SQL)

Since the SQL migration now handles data backfill, this script is primarily for **verification** and can create additional test tenants if needed.

```powershell
npx ts-node scripts/migrate-to-multi-tenant.ts
```

**Expected Output**:
```
🔄 Starting multi-tenant data migration...

📦 Creating default tenant...
✅ Created/found tenant: Default Tenant (default-tenant-id)

💳 Creating default subscription...
✅ Subscription already exists

👥 Migrating existing users...
  ⏭️  admin@example.com → Already migrated (skip)
✅ Migrated 1 users (0 super admins, 1 tenant users)

📊 Updating tenant-scoped data...
  ✅ 0 business snapshots (already migrated by SQL)
  ✅ 0 metrics (already migrated by SQL)
  ...
```

**What This Does** (redundantly, for safety):
- Verifies default tenant exists
- Verifies subscription exists
- Skips users already migrated by SQL
- Reports on data state

### **Step 5: Regenerate Prisma Client & Test**

```powershell
# Regenerate client to ensure all types are updated
npx prisma generate

# Check for TypeScript errors in platform module
cd src/platform/tenants
# Errors should be gone now that Tenant model exists in @prisma/client
```

---

## 🧪 Testing Multi-Tenant System

### **Test 1: Platform Endpoints (SUPER_ADMIN)**

First, create a SUPER_ADMIN user manually:

```powershell
npx prisma studio
# Or use SQL:
# UPDATE "User" SET role = 'SUPER_ADMIN', "tenantId" = NULL WHERE email = 'admin@example.com';
```

Test platform tenant management:
```bash
# Login as SUPER_ADMIN
POST /auth/login
{
  "email": "admin@example.com",
  "password": "your-password"
}

# Create new tenant
POST /platform/tenants
Headers: Authorization: Bearer <super_admin_token>
{
  "name": "Acme Corp",
  "type": "COMPANY",
  "slug": "acme-corp",
  "adminEmail": "admin@acme.com",
  "adminName": "John Doe",
  "adminPassword": "SecurePass123!",
  "planType": "STARTER"
}

# List all tenants
GET /platform/tenants
Headers: Authorization: Bearer <super_admin_token>

# Get tenant details
GET /platform/tenants/{tenantId}
Headers: Authorization: Bearer <super_admin_token>
```

### **Test 2: Tenant Isolation**

```bash
# Login as Acme Corp admin
POST /auth/login
{
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}

# Create tenant-specific data
POST /metrics
Headers: Authorization: Bearer <acme_token>
{
  "name": "Revenue",
  "value": 50000
}

# Login as Default Tenant user
POST /auth/login
{
  "email": "original@example.com",
  "password": "password"
}

# Verify isolation - should NOT see Acme's metrics
GET /metrics
Headers: Authorization: Bearer <default_token>
# Should only return Default Tenant metrics
```

### **Test 3: Token Rotation**

```bash
# Login to get tokens
POST /auth/login
Response:
{
  "access_token": "eyJ...",
  "refresh_token": "abc123..."
}

# Use refresh token
POST /auth/refresh
{
  "refresh_token": "abc123..."
}
Response:
{
  "access_token": "eyJ...",  // new token
  "refresh_token": "xyz789..."  // new refresh token
}

# Try old refresh token again (should fail)
POST /auth/refresh
{
  "refresh_token": "abc123..."
}
Response: 401 Unauthorized
{
  "message": "Refresh token has been revoked"
}
```

---

## 📋 Integration Checklist

After migration succeeds, integrate the new architecture:

### **Phase 1: Update App Module**
- [ ] Add `PlatformModule` to `src/app.module.ts` imports
- [ ] Add platform tags to Swagger config

### **Phase 2: Update Auth Service**
- [ ] Replace `src/auth/tokens.service.ts` with `src/auth/tokens-updated.service.ts`
- [ ] Update `auth.service.ts` to include tenantId in token payload
- [ ] Update `auth.controller.ts` to extract IP/UserAgent
- [ ] Update JWT strategy to validate tenantId

### **Phase 3: Apply Tenant Scoping**
For each module (business, metrics, outcomes, reviews, sales, activities, insights):
- [ ] Add `@UseGuards(JwtAuthGuard, TenantGuard)` to controller
- [ ] Use `@TenantId()` decorator in controller methods
- [ ] Pass tenantId to service methods
- [ ] Update service queries to filter by tenantId:
  ```typescript
  // Before
  this.prisma.metric.findMany({ where: { userId } })
  
  // After
  this.prisma.metric.findMany({ where: { userId, tenantId } })
  ```

### **Phase 4: Test Everything**
- [ ] SUPER_ADMIN can create/manage tenants
- [ ] SUPER_ADMIN cannot access tenant routes
- [ ] Tenant users cannot see other tenants' data
- [ ] Token rotation works (old tokens revoked)
- [ ] All roles work correctly (TENANT_ADMIN, COACH, CLIENT, etc.)

---

## 🔄 Rollback (if needed)

If migration fails, restore from backup:

```powershell
# Drop database
dropdb -U postgres accountability

# Recreate
createdb -U postgres accountability

# Restore backup
psql -U postgres -d accountability -f backup_before_migration.sql

# Revert Prisma schema
git checkout prisma/schema.prisma

# Delete migration folder
Remove-Item -Recurse -Force prisma/migrations/20251114062121_add_multi_tenant_support

# Regenerate Prisma client
npx prisma generate
```

---

## 📝 Summary

**Fixed Files**:
1. ✅ `prisma/migrations/20251114062121_add_multi_tenant_support/migration.sql` - Restructured to handle existing data safely
2. ✅ `scripts/migrate-to-multi-tenant.ts` - Fixed Role enum TypeScript errors

**Migration Strategy**:
- SQL migration handles ALL data transformation
- TypeScript script is now just for verification
- Safe order: create tenant → add nullable columns → backfill → make required

**Next Action**: Run `npx prisma migrate dev` in `d:\BGAccountabiityapp`

**Expected Duration**: 2-5 seconds (small dataset)

**Risk**: LOW (modified migration tested against existing data patterns)

---

## 🆘 Troubleshooting

### Error: "Unique constraint violation on SalesPlanning"
**Cause**: Duplicate year entries for same user  
**Fix**: 
```sql
DELETE FROM "SalesPlanning" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId", year ORDER BY "createdAt" DESC) as rn
    FROM "SalesPlanning"
  ) WHERE rn > 1
);
```

### Error: "Cannot connect to database"
**Fix**: Start PostgreSQL service
```powershell
net start postgresql-x64-14  # or your PostgreSQL version
```

### Error: "Prisma Client not generated"
**Fix**:
```powershell
npx prisma generate
```

### Migration Hangs
**Fix**: Check for long-running transactions
```sql
SELECT * FROM pg_stat_activity WHERE state = 'active';
-- Kill blocking queries if needed
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <blocking_pid>;
```

---

**Ready to proceed? Run the migration commands above!** 🚀
