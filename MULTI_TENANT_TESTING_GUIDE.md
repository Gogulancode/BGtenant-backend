# Multi-Tenant Testing Guide

## 🚀 Servers Running

### Backend (NestJS)
- **URL:** http://localhost:3002
- **API Docs:** http://localhost:3002/api/docs
- **Status:** ✅ Running

### Frontend (Next.js)
- **URL:** http://localhost:3000
- **Status:** ✅ Running

---

## 🔐 Current Architecture: Single URL, Role-Based Access

**IMPORTANT:** In the current setup, there is **ONE URL** for both SUPER_ADMIN and regular tenant users:
- **URL:** http://localhost:3000

The system uses **role-based access control (RBAC)** to determine what each user can see and do:

### User Types and Access:

#### 1️⃣ **SUPER_ADMIN** (Platform Administrator)
- **Credentials:**
  - Email: `superadmin@bg.com`
  - Password: `SuperAdmin123!`
- **Tenant:** NO tenant (tenantId = null)
- **Access:**
  - ✅ Can access `/api/v1/super-admin/*` routes
  - ✅ Can manage all tenants via Platform API
  - ✅ Can create new tenants
  - ❌ CANNOT access tenant-scoped routes (metrics, outcomes, etc.)
  - ❌ Should NOT see regular dashboard features
- **Purpose:** Manage the entire platform, create tenants, monitor system health

#### 2️⃣ **TENANT_ADMIN** (Organization Administrator)
- **Credentials:** (If any exist - check with Prisma Studio)
  - Default Tenant: `default-tenant-id`
- **Tenant:** Belongs to a specific tenant
- **Access:**
  - ✅ Can access all tenant-scoped routes for their tenant
  - ✅ Can manage users within their tenant
  - ✅ Full access to dashboard features (metrics, outcomes, reviews, etc.)
  - ❌ CANNOT access other tenants' data
  - ❌ CANNOT access super-admin routes

#### 3️⃣ **CLIENT** (Regular User)
- **Credentials:** Create via registration or TENANT_ADMIN
- **Tenant:** Belongs to a specific tenant
- **Access:**
  - ✅ Can access their own data (metrics, outcomes, reviews)
  - ✅ Limited dashboard access
  - ❌ CANNOT manage other users
  - ❌ CANNOT access admin features

---

## 🧪 Testing Scenarios

### Scenario 1: Test SUPER_ADMIN

#### 1. Login as SUPER_ADMIN
```powershell
# In PowerShell
$body = @{
  email = "superadmin@bg.com"
  password = "SuperAdmin123!"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

Write-Host "✅ Logged in as: $($response.user.name)"
Write-Host "Role: $($response.user.role)"
Write-Host "Tenant ID: $($response.user.tenantId)" # Should be null

$global:SUPER_TOKEN = $response.access_token
```

#### 2. Test SUPER_ADMIN Routes
```powershell
# List all users (super-admin only)
$headers = @{ Authorization = "Bearer $SUPER_TOKEN" }

Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/super-admin/users" `
  -Method GET `
  -Headers $headers | ConvertTo-Json

# Get analytics (super-admin only)
Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/super-admin/analytics" `
  -Method GET `
  -Headers $headers | ConvertTo-Json
```

#### 3. Try Accessing Tenant Routes (Should Fail)
```powershell
# This should return 403 Forbidden or error
# Because SUPER_ADMIN has no tenantId
Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method GET `
  -Headers $headers
# Expected: Error - SUPER_ADMIN cannot access tenant routes
```

#### 4. Frontend: Login at http://localhost:3000/auth/login
- Login with `superadmin@bg.com`
- **Expected Behavior:**
  - Should redirect to dashboard
  - Dashboard should show SUPER_ADMIN specific features
  - Should NOT show tenant-specific features (metrics, outcomes)
  - Ideally should show "Platform Management" or "Tenant Management" section

---

### Scenario 2: Create a New Tenant (SUPER_ADMIN)

Since we don't have the PlatformModule integrated yet, you can create a tenant using Prisma Studio or SQL:

#### Option A: Using Prisma Studio
```powershell
# In D:\BGAccountabiityapp
npx prisma studio
```

1. Open http://localhost:5555
2. Click on `Tenant` model
3. Click "Add Record"
4. Fill in:
   - id: `test-tenant-id`
   - name: `Test Tenant`
   - type: `COMPANY`
   - slug: `test-tenant`
   - isActive: `true`
5. Save

6. Click on `Subscription` model
7. Click "Add Record"
8. Fill in:
   - id: (auto-generate)
   - tenantId: `test-tenant-id`
   - planType: `STARTER`
   - status: `ACTIVE`
   - billingCycle: `MONTHLY`
   - maxUsers: `10`
   - maxMetrics: `20`
   - maxActivities: `100`
9. Save

#### Option B: Using SQL
```powershell
# Create tenant via SQL
$sql = @"
-- Insert new tenant
INSERT INTO "Tenant" (id, name, type, slug, "isActive", "createdAt", "updatedAt")
VALUES ('test-tenant-id', 'Test Tenant', 'COMPANY', 'test-tenant', true, NOW(), NOW());

-- Insert subscription for tenant
INSERT INTO "Subscription" (id, "tenantId", "planType", status, "billingCycle", "maxUsers", "maxMetrics", "maxActivities", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'test-tenant-id', 'STARTER', 'ACTIVE', 'MONTHLY', 10, 20, 100, NOW(), NOW());
"@

# Execute in database
```

---

### Scenario 3: Register a TENANT_ADMIN User

```powershell
# Register a new user for the test tenant
$body = @{
  email = "admin@testtenant.com"
  password = "TestAdmin123!"
  name = "Test Tenant Admin"
  businessType = "Startup"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

Write-Host "✅ User created: $($response.user.name)"
Write-Host "Role: $($response.user.role)" # Should be CLIENT by default
Write-Host "Tenant ID: $($response.user.tenantId)" # Should be default-tenant-id

$global:TENANT_TOKEN = $response.access_token
```

**Note:** New registrations are assigned to `default-tenant-id` and role `CLIENT` by default. You'll need to:
1. Change their `tenantId` to `test-tenant-id` in database
2. Change their `role` to `TENANT_ADMIN`

#### Update User Tenant and Role (via Prisma Studio):
1. Open http://localhost:5555
2. Click on `User` model
3. Find the user `admin@testtenant.com`
4. Edit:
   - tenantId: `test-tenant-id`
   - role: `TENANT_ADMIN`
5. Save

---

### Scenario 4: Test TENANT_ADMIN Access

```powershell
# Login as tenant admin
$body = @{
  email = "admin@testtenant.com"
  password = "TestAdmin123!"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

Write-Host "✅ Logged in as: $($response.user.name)"
Write-Host "Role: $($response.user.role)" # Should be TENANT_ADMIN
Write-Host "Tenant ID: $($response.user.tenantId)" # Should be test-tenant-id

$global:TENANT_TOKEN = $response.access_token
```

#### Test Tenant-Scoped Routes
```powershell
$headers = @{ Authorization = "Bearer $TENANT_TOKEN" }

# Get metrics (should work)
Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method GET `
  -Headers $headers | ConvertTo-Json

# Create a metric
$body = @{
  name = "Monthly Revenue"
  category = "Sales"
  targetValue = 50000
  currentValue = 0
  unit = "USD"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method POST `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $body | ConvertTo-Json
```

#### Try Accessing SUPER_ADMIN Routes (Should Fail)
```powershell
# This should return 403 Forbidden
Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/super-admin/users" `
  -Method GET `
  -Headers $headers
# Expected: Error - Insufficient permissions
```

---

### Scenario 5: Test Data Isolation Between Tenants

#### 1. Create data for Default Tenant
```powershell
# Login as default tenant user
$body = @{
  email = "superadmin@bg.com" # Or any user in default-tenant-id
  password = "SuperAdmin123!"
} | ConvertTo-Json

# Note: superadmin won't work because it has no tenantId
# You need a regular user in default-tenant-id
```

**First, create a user for default tenant:**
1. Open Prisma Studio: http://localhost:5555
2. Create a new user:
   - email: `default@tenant.com`
   - password: (hash `Password123!` using bcrypt - use online tool or create script)
   - name: `Default Tenant User`
   - businessType: `MSME`
   - role: `TENANT_ADMIN`
   - tenantId: `default-tenant-id`

```powershell
# Login as default tenant user
$body = @{
  email = "default@tenant.com"
  password = "Password123!"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$DEFAULT_TOKEN = $response.access_token

# Create metric for default tenant
$headers = @{ Authorization = "Bearer $DEFAULT_TOKEN" }
$body = @{
  name = "Default Tenant Metric"
  category = "Finance"
  targetValue = 100000
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method POST `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $body
```

#### 2. Create data for Test Tenant
```powershell
# Login as test tenant admin
$body = @{
  email = "admin@testtenant.com"
  password = "TestAdmin123!"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$TEST_TOKEN = $response.access_token

# Create metric for test tenant
$headers = @{ Authorization = "Bearer $TEST_TOKEN" }
$body = @{
  name = "Test Tenant Metric"
  category = "Marketing"
  targetValue = 50000
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method POST `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $body
```

#### 3. Verify Isolation
```powershell
# Get metrics as default tenant user
$headers = @{ Authorization = "Bearer $DEFAULT_TOKEN" }
$defaultMetrics = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method GET `
  -Headers $headers

Write-Host "Default Tenant Metrics:"
$defaultMetrics | ConvertTo-Json

# Get metrics as test tenant user
$headers = @{ Authorization = "Bearer $TEST_TOKEN" }
$testMetrics = Invoke-RestMethod `
  -Uri "http://localhost:3002/api/v1/metrics" `
  -Method GET `
  -Headers $headers

Write-Host "`nTest Tenant Metrics:"
$testMetrics | ConvertTo-Json

# Expected: Each tenant only sees their own data
```

---

## 🎨 Frontend Testing

### Login Page: http://localhost:3000/auth/login

#### Test 1: Login as SUPER_ADMIN
1. Navigate to http://localhost:3000/auth/login
2. Enter:
   - Email: `superadmin@bg.com`
   - Password: `SuperAdmin123!`
3. Click Login
4. **Expected:**
   - Redirect to `/dashboard`
   - Dashboard shows SUPER_ADMIN features only
   - Should see platform management options
   - Should NOT see metrics, outcomes, etc.

#### Test 2: Login as TENANT_ADMIN
1. Navigate to http://localhost:3000/auth/login
2. Enter:
   - Email: `admin@testtenant.com` (or any tenant admin)
   - Password: `TestAdmin123!`
3. Click Login
4. **Expected:**
   - Redirect to `/dashboard`
   - Dashboard shows full tenant features
   - Can see metrics, outcomes, reviews, sales, activities
   - Can navigate all tenant routes
   - Tenant name displayed in header: "Test Tenant"

#### Test 3: Login as CLIENT
1. Create a CLIENT user for test tenant (via Prisma Studio)
2. Login with CLIENT credentials
3. **Expected:**
   - Redirect to `/dashboard`
   - Limited dashboard access
   - Can see their own data only
   - Cannot manage other users

---

## 🚨 Known Issues & Next Steps

### Current Limitations:

1. **⚠️ SUPER_ADMIN Cannot Access Dashboard Properly**
   - SUPER_ADMIN has no tenantId
   - Frontend may show errors when trying to load tenant-scoped data
   - **Solution:** Add special handling for SUPER_ADMIN in frontend

2. **⚠️ No Platform Management UI Yet**
   - SUPER_ADMIN needs a dedicated "Platform" section
   - Should show:
     - List of all tenants
     - Create new tenant
     - Manage subscriptions
     - System analytics
   - **Solution:** Create `/platform` route (admin only)

3. **⚠️ PlatformModule Not Integrated**
   - Cannot create tenants via API yet
   - Must use Prisma Studio or SQL
   - **Solution:** Import PlatformModule in app.module.ts

4. **⚠️ No Tenant Switching for SUPER_ADMIN**
   - SUPER_ADMIN cannot "impersonate" or view tenant data
   - **Solution:** Add tenant context switching for SUPER_ADMIN

5. **⚠️ Frontend Doesn't Show Tenant Name**
   - Users don't know which tenant they're in
   - **Solution:** Add tenant name to navbar/header

### Next Steps to Complete Multi-Tenant:

1. **Integrate PlatformModule** (Priority 1)
   ```typescript
   // src/app.module.ts
   import { PlatformModule } from './platform/platform.module';
   
   @Module({
     imports: [
       // ... existing modules
       PlatformModule, // Add this
     ],
   })
   ```

2. **Create Platform Admin UI** (Priority 2)
   - Route: `/platform` (SUPER_ADMIN only)
   - Features:
     - List all tenants
     - Create new tenant with admin user
     - View subscription details
     - System analytics

3. **Update Frontend for SUPER_ADMIN** (Priority 3)
   - Detect role === SUPER_ADMIN
   - Redirect to `/platform` instead of `/dashboard`
   - Show platform management features

4. **Add Tenant Name Display** (Priority 4)
   - Update JWT to include tenant info
   - Show tenant name in navbar
   - Show current organization

5. **Implement TenantGuard** (Priority 5)
   - Apply to all tenant-scoped controllers
   - Ensure data isolation
   - Block SUPER_ADMIN from tenant routes

6. **Update Service Queries** (Priority 6)
   - Add tenantId filter to all findMany queries
   - Ensure update/delete operations check tenantId

---

## 📊 Verify Database State

### Using Prisma Studio
```powershell
cd D:\BGAccountabiityapp
npx prisma studio
```

Open http://localhost:5555 and check:

1. **Tenant Table:**
   - Should have `default-tenant-id` and `test-tenant-id`

2. **Subscription Table:**
   - Each tenant should have a subscription

3. **User Table:**
   - `superadmin@bg.com` → role: SUPER_ADMIN, tenantId: null
   - Other users → role: TENANT_ADMIN/CLIENT, tenantId: tenant UUID

4. **Metric/Outcome/etc Tables:**
   - All records should have a tenantId
   - Records should belong to specific tenants

---

## 🎯 Summary

### Same URL, Different Access:
- **URL:** http://localhost:3000 (for all users)
- **Backend:** http://localhost:3002 (all API calls)

### Access Control by Role:

| Role          | Tenant? | Can Access Dashboard | Can Access Platform | Can Manage Tenant |
|---------------|---------|----------------------|---------------------|-------------------|
| SUPER_ADMIN   | No      | ❌ No                | ✅ Yes              | ✅ All Tenants    |
| TENANT_ADMIN  | Yes     | ✅ Yes               | ❌ No               | ✅ Own Tenant     |
| CLIENT        | Yes     | ✅ Limited           | ❌ No               | ❌ No             |
| COACH         | Yes     | ✅ Coaching View     | ❌ No               | ❌ No             |
| MANAGER       | Yes     | ✅ Team View         | ❌ No               | ⚠️ Limited        |
| VIEWER        | Yes     | ✅ Read-Only         | ❌ No               | ❌ No             |

### Testing Flow:
1. ✅ Start both servers
2. ✅ Login as SUPER_ADMIN → Test platform routes
3. ✅ Create new tenant (via Prisma Studio)
4. ✅ Create TENANT_ADMIN user for new tenant
5. ✅ Login as TENANT_ADMIN → Test tenant routes
6. ✅ Create data for both tenants
7. ✅ Verify data isolation

**Current Status:** Backend multi-tenant architecture complete, frontend needs SUPER_ADMIN specific UI and tenant name display.
