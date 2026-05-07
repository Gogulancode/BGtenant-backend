# Tenant Sales Cycle CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Excel wireframe's Sales Cycle Closure / Conversion Ratio feature as a production tenant CRM/prospect tracker.

**Architecture:** Add a tenant-scoped `SalesProspect` model and focused NestJS controller/service files under the existing sales module. Add typed frontend API functions, React Query hooks, and a `SalesProspectsPanel` component that plugs into the existing Sales page as a new tab.

**Tech Stack:** NestJS, Prisma, PostgreSQL, class-validator, Jest, React 18, Vite, React Query, React Hook Form, Zod, shadcn/Radix UI.

---

## File Structure

Backend:

- Modify: `D:\BGAccountabiityapp\prisma\schema.prisma`
- Create: `D:\BGAccountabiityapp\prisma\migrations\20260506151000_add_sales_prospects\migration.sql`
- Create: `D:\BGAccountabiityapp\src\sales\dto\sales-prospect.dto.ts`
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.ts`
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.controller.ts`
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.spec.ts`
- Modify: `D:\BGAccountabiityapp\src\sales\sales.module.ts`

Frontend:

- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\hooks\useSales.ts`
- Create: `D:\bridge-gaps-dashboard-main\src\components\sales\SalesProspectsPanel.tsx`
- Modify: `D:\bridge-gaps-dashboard-main\src\components\sales\index.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Sales.tsx`

Verification:

- Run: `npm run build` in `D:\BGAccountabiityapp`
- Run: `npm test -- --runInBand src/sales/sales-prospects.service.spec.ts` in `D:\BGAccountabiityapp`
- Run: `npm run build` in `D:\bridge-gaps-dashboard-main`

---

## Task 1: Add SalesProspect Prisma Model

**Files:**
- Modify: `D:\BGAccountabiityapp\prisma\schema.prisma`
- Create: `D:\BGAccountabiityapp\prisma\migrations\20260506151000_add_sales_prospects\migration.sql`

- [ ] **Step 1: Add enums and relation fields to Prisma schema**

Add these enums near the existing sales-related enums:

```prisma
enum SalesProspectStatus {
  COLD
  WARM
  HOT
  CONVERTED
  REJECTED
}

enum SalesProspectReason {
  BUDGET
  AUTHORITY
  NEED
  TIMELINE
  AVAILABILITY
  CLOSURE
  OTHER
}
```

Add relation arrays:

```prisma
model Tenant {
  // existing fields
  salesProspects SalesProspect[]
}

model User {
  // existing fields
  salesProspects SalesProspect[]
}
```

Add the model:

```prisma
model SalesProspect {
  id                String               @id @default(cuid())
  userId            String
  tenantId          String
  month             String
  firstCallAt       DateTime?
  prospectName      String
  mobileNumber      String?
  offeringType      String?
  proposalValue     Float?
  referralSource    String?
  lastFollowUpAt    DateTime?
  status            SalesProspectStatus  @default(COLD)
  reason            SalesProspectReason?
  remarks           String?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, month])
  @@index([tenantId, status])
  @@index([tenantId, lastFollowUpAt])
}
```

- [ ] **Step 2: Create migration**

Run:

```powershell
npx prisma migrate dev --name add_sales_prospects
```

Expected: Prisma creates a migration and regenerates client.

- [ ] **Step 3: If local database migration cannot run, create SQL migration manually**

Create `prisma/migrations/20260506151000_add_sales_prospects/migration.sql`:

```sql
CREATE TYPE "SalesProspectStatus" AS ENUM ('COLD', 'WARM', 'HOT', 'CONVERTED', 'REJECTED');
CREATE TYPE "SalesProspectReason" AS ENUM ('BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE', 'AVAILABILITY', 'CLOSURE', 'OTHER');

CREATE TABLE "SalesProspect" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "firstCallAt" TIMESTAMP(3),
  "prospectName" TEXT NOT NULL,
  "mobileNumber" TEXT,
  "offeringType" TEXT,
  "proposalValue" DOUBLE PRECISION,
  "referralSource" TEXT,
  "lastFollowUpAt" TIMESTAMP(3),
  "status" "SalesProspectStatus" NOT NULL DEFAULT 'COLD',
  "reason" "SalesProspectReason",
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesProspect_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesProspect_tenantId_userId_month_idx" ON "SalesProspect"("tenantId", "userId", "month");
CREATE INDEX "SalesProspect_tenantId_status_idx" ON "SalesProspect"("tenantId", "status");
CREATE INDEX "SalesProspect_tenantId_lastFollowUpAt_idx" ON "SalesProspect"("tenantId", "lastFollowUpAt");

ALTER TABLE "SalesProspect" ADD CONSTRAINT "SalesProspect_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesProspect" ADD CONSTRAINT "SalesProspect_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Verify backend still builds**

Run:

```powershell
npm run build
```

Expected: `nest build` exits `0`.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add tenant sales prospect model"
```

---

## Task 2: Add Backend DTOs

**Files:**
- Create: `D:\BGAccountabiityapp\src\sales\dto\sales-prospect.dto.ts`

- [ ] **Step 1: Create DTO file**

```typescript
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { SalesProspectReason, SalesProspectStatus } from "@prisma/client";

export class SalesProspectQueryDto {
  @ApiPropertyOptional({ example: "2026-05" })
  @IsOptional()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @ApiPropertyOptional({ enum: SalesProspectStatus })
  @IsOptional()
  @IsEnum(SalesProspectStatus)
  status?: SalesProspectStatus;

  @ApiPropertyOptional({ enum: SalesProspectReason })
  @IsOptional()
  @IsEnum(SalesProspectReason)
  reason?: SalesProspectReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class CreateSalesProspectDto {
  @ApiProperty({ example: "2026-05" })
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month: string;

  @ApiPropertyOptional({ example: "2026-05-06" })
  @IsOptional()
  @IsDateString()
  firstCallAt?: string;

  @ApiProperty({ example: "Acme Industries" })
  @IsString()
  @MinLength(2)
  prospectName: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional({ example: "Sales Excellence Workshop" })
  @IsOptional()
  @IsString()
  offeringType?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proposalValue?: number;

  @ApiPropertyOptional({ example: "Referral" })
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional({ example: "2026-05-10" })
  @IsOptional()
  @IsDateString()
  lastFollowUpAt?: string;

  @ApiPropertyOptional({ enum: SalesProspectStatus })
  @IsOptional()
  @IsEnum(SalesProspectStatus)
  status?: SalesProspectStatus;

  @ApiPropertyOptional({ enum: SalesProspectReason })
  @IsOptional()
  @IsEnum(SalesProspectReason)
  reason?: SalesProspectReason;

  @ApiPropertyOptional({ example: "Asked to follow up next week." })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateSalesProspectDto extends CreateSalesProspectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  month: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  prospectName: string;
}
```

- [ ] **Step 2: Run TypeScript build**

Run:

```powershell
npm run build
```

Expected: build fails only if Prisma client has not been regenerated after Task 1. If it fails on missing enums, run `npx prisma generate`.

- [ ] **Step 3: Commit**

```powershell
git add src/sales/dto/sales-prospect.dto.ts
git commit -m "feat: add sales prospect dto validation"
```

---

## Task 3: Add SalesProspectsService With Tests

**Files:**
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.ts`
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/sales/sales-prospects.service.spec.ts`:

```typescript
import { NotFoundException } from "@nestjs/common";
import { SalesProspectStatus } from "@prisma/client";
import { SalesProspectsService } from "./sales-prospects.service";

describe("SalesProspectsService", () => {
  const prisma = {
    salesProspect: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  } as any;

  let service: SalesProspectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesProspectsService(prisma);
  });

  it("lists prospects inside the tenant scope with search and pagination", async () => {
    prisma.salesProspect.findMany.mockResolvedValue([{ id: "prospect-1" }]);
    prisma.salesProspect.count.mockResolvedValue(1);

    const result = await service.list("user-1", "tenant-1", {
      search: "acme",
      page: 1,
      pageSize: 10,
    });

    expect(prisma.salesProspect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          tenantId: "tenant-1",
          OR: expect.any(Array),
        }),
        take: 10,
        skip: 0,
      }),
    );
    expect(result.total).toBe(1);
  });

  it("creates a tenant-scoped prospect", async () => {
    prisma.salesProspect.create.mockResolvedValue({ id: "prospect-1" });

    const result = await service.create("user-1", "tenant-1", {
      month: "2026-05",
      prospectName: "Acme",
      proposalValue: 1000,
    });

    expect(prisma.salesProspect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tenantId: "tenant-1",
        month: "2026-05",
        prospectName: "Acme",
        proposalValue: 1000,
      }),
    });
    expect(result.id).toBe("prospect-1");
  });

  it("throws when updating a prospect outside tenant scope", async () => {
    prisma.salesProspect.findFirst.mockResolvedValue(null);

    await expect(
      service.update("user-1", "tenant-1", "prospect-2", {
        status: SalesProspectStatus.HOT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

Expected: fail because `sales-prospects.service.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `src/sales/sales-prospects.service.ts`:

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";
import {
  CreateSalesProspectDto,
  SalesProspectQueryDto,
  UpdateSalesProspectDto,
} from "./dto/sales-prospect.dto";

@Injectable()
export class SalesProspectsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, tenantId: string | null | undefined, query: SalesProspectQueryDto) {
    const scopedTenantId = assertTenantContext(tenantId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SalesProspectWhereInput = {
      userId,
      tenantId: scopedTenantId,
      month: query.month,
      status: query.status,
      reason: query.reason,
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { prospectName: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
        { offeringType: { contains: search, mode: "insensitive" } },
        { referralSource: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesProspect.findMany({
        where,
        orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salesProspect.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(userId: string, tenantId: string | null | undefined, dto: CreateSalesProspectDto) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.salesProspect.create({
      data: this.toData(userId, scopedTenantId, dto),
    });
  }

  async getById(userId: string, tenantId: string | null | undefined, id: string) {
    const scopedTenantId = assertTenantContext(tenantId);
    const prospect = await this.prisma.salesProspect.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });
    if (!prospect) throw new NotFoundException("Sales prospect not found");
    return prospect;
  }

  async update(userId: string, tenantId: string | null | undefined, id: string, dto: UpdateSalesProspectDto) {
    const existing = await this.getById(userId, tenantId, id);
    return this.prisma.salesProspect.update({
      where: { id: existing.id },
      data: this.toUpdateData(dto),
    });
  }

  async remove(userId: string, tenantId: string | null | undefined, id: string) {
    const existing = await this.getById(userId, tenantId, id);
    await this.prisma.salesProspect.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async summary(userId: string, tenantId: string | null | undefined, month?: string) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: Prisma.SalesProspectWhereInput = { userId, tenantId: scopedTenantId, month };
    const [pipeline, converted, byStatus] = await Promise.all([
      this.prisma.salesProspect.aggregate({ where, _sum: { proposalValue: true }, _count: true }),
      this.prisma.salesProspect.aggregate({
        where: { ...where, status: SalesProspectStatus.CONVERTED },
        _sum: { proposalValue: true },
        _count: true,
      }),
      this.prisma.salesProspect.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    return {
      totalProspects: pipeline._count,
      pipelineValue: pipeline._sum.proposalValue ?? 0,
      convertedCount: converted._count,
      convertedValue: converted._sum.proposalValue ?? 0,
      byStatus: byStatus.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
    };
  }

  private toData(userId: string, tenantId: string, dto: CreateSalesProspectDto): Prisma.SalesProspectCreateInput {
    return {
      user: { connect: { id: userId } },
      tenant: { connect: { id: tenantId } },
      month: dto.month,
      firstCallAt: dto.firstCallAt ? new Date(dto.firstCallAt) : undefined,
      prospectName: dto.prospectName,
      mobileNumber: dto.mobileNumber,
      offeringType: dto.offeringType,
      proposalValue: dto.proposalValue,
      referralSource: dto.referralSource,
      lastFollowUpAt: dto.lastFollowUpAt ? new Date(dto.lastFollowUpAt) : undefined,
      status: dto.status,
      reason: dto.reason,
      remarks: dto.remarks,
    };
  }

  private toUpdateData(dto: UpdateSalesProspectDto): Prisma.SalesProspectUpdateInput {
    return {
      month: dto.month,
      firstCallAt: dto.firstCallAt ? new Date(dto.firstCallAt) : undefined,
      prospectName: dto.prospectName,
      mobileNumber: dto.mobileNumber,
      offeringType: dto.offeringType,
      proposalValue: dto.proposalValue,
      referralSource: dto.referralSource,
      lastFollowUpAt: dto.lastFollowUpAt ? new Date(dto.lastFollowUpAt) : undefined,
      status: dto.status,
      reason: dto.reason,
      remarks: dto.remarks,
    };
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run:

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

Expected: all tests in `sales-prospects.service.spec.ts` pass.

- [ ] **Step 5: Commit**

```powershell
git add src/sales/sales-prospects.service.ts src/sales/sales-prospects.service.spec.ts
git commit -m "feat: add sales prospect service"
```

---

## Task 4: Add SalesProspectsController

**Files:**
- Create: `D:\BGAccountabiityapp\src\sales\sales-prospects.controller.ts`
- Modify: `D:\BGAccountabiityapp\src\sales\sales.module.ts`

- [ ] **Step 1: Create controller**

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser, UserContext } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { TENANT_LEADERSHIP_ROLES, TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import {
  CreateSalesProspectDto,
  SalesProspectQueryDto,
  UpdateSalesProspectDto,
} from "./dto/sales-prospect.dto";
import { SalesProspectsService } from "./sales-prospects.service";

@ApiTags("Sales Prospects")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sales/prospects")
export class SalesProspectsController {
  constructor(private prospectsService: SalesProspectsService) {}

  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  @ApiOperation({ summary: "List sales prospects" })
  @ApiOkResponse({ description: "Paginated sales prospects" })
  list(@CurrentUser() user: UserContext, @Query() query: SalesProspectQueryDto) {
    return this.prospectsService.list(user.userId, user.tenantId, query);
  }

  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  @ApiOperation({ summary: "Get sales prospect summary" })
  summary(@CurrentUser() user: UserContext, @Query("month") month?: string) {
    return this.prospectsService.summary(user.userId, user.tenantId, month);
  }

  @Get(":id")
  @Roles(...TENANT_MEMBER_ROLES)
  @ApiOperation({ summary: "Get sales prospect by ID" })
  getById(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.prospectsService.getById(user.userId, user.tenantId, id);
  }

  @Post()
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @ApiOperation({ summary: "Create sales prospect" })
  @ApiCreatedResponse({ description: "Sales prospect created" })
  create(@CurrentUser() user: UserContext, @Body() dto: CreateSalesProspectDto) {
    return this.prospectsService.create(user.userId, user.tenantId, dto);
  }

  @Patch(":id")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @ApiOperation({ summary: "Update sales prospect" })
  update(@CurrentUser() user: UserContext, @Param("id") id: string, @Body() dto: UpdateSalesProspectDto) {
    return this.prospectsService.update(user.userId, user.tenantId, id, dto);
  }

  @Delete(":id")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  @ApiOperation({ summary: "Delete sales prospect" })
  remove(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.prospectsService.remove(user.userId, user.tenantId, id);
  }
}
```

- [ ] **Step 2: Register service and controller**

Modify `src/sales/sales.module.ts`:

```typescript
import { Module, forwardRef } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { SalesTargetsService } from "./sales-targets.service";
import { SalesController } from "./sales.controller";
import { SalesProspectsController } from "./sales-prospects.controller";
import { SalesProspectsService } from "./sales-prospects.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [SalesController, SalesProspectsController],
  providers: [SalesService, SalesTargetsService, SalesProspectsService],
  exports: [SalesService, SalesTargetsService, SalesProspectsService],
})
export class SalesModule {}
```

- [ ] **Step 3: Build backend**

Run:

```powershell
npm run build
```

Expected: build exits `0`.

- [ ] **Step 4: Commit**

```powershell
git add src/sales/sales-prospects.controller.ts src/sales/sales.module.ts
git commit -m "feat: expose sales prospect endpoints"
```

---

## Task 5: Add Frontend API Types and Hooks

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\hooks\useSales.ts`

- [ ] **Step 1: Add API types and functions**

Append to `src/lib/api.ts`:

```typescript
export type SalesProspectStatus = "COLD" | "WARM" | "HOT" | "CONVERTED" | "REJECTED";
export type SalesProspectReason =
  | "BUDGET"
  | "AUTHORITY"
  | "NEED"
  | "TIMELINE"
  | "AVAILABILITY"
  | "CLOSURE"
  | "OTHER";

export type SalesProspect = {
  id: string;
  month: string;
  firstCallAt: string | null;
  prospectName: string;
  mobileNumber: string | null;
  offeringType: string | null;
  proposalValue: number | null;
  referralSource: string | null;
  lastFollowUpAt: string | null;
  status: SalesProspectStatus;
  reason: SalesProspectReason | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SalesProspectPayload = {
  month: string;
  firstCallAt?: string;
  prospectName: string;
  mobileNumber?: string;
  offeringType?: string;
  proposalValue?: number;
  referralSource?: string;
  lastFollowUpAt?: string;
  status?: SalesProspectStatus;
  reason?: SalesProspectReason;
  remarks?: string;
};

export type SalesProspectListParams = {
  page?: number;
  pageSize?: number;
  month?: string;
  status?: SalesProspectStatus;
  reason?: SalesProspectReason;
  search?: string;
};

export type SalesProspectListResponse = {
  data: SalesProspect[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SalesProspectSummary = {
  totalProspects: number;
  pipelineValue: number;
  convertedCount: number;
  convertedValue: number;
  byStatus: Record<SalesProspectStatus, number>;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getSalesProspects(params: SalesProspectListParams = {}): Promise<SalesProspectListResponse> {
  return api(`/api/v1/sales/prospects${toQuery(params)}`);
}

export async function getSalesProspectSummary(month?: string): Promise<SalesProspectSummary> {
  return api(`/api/v1/sales/prospects/summary${toQuery({ month })}`);
}

export async function createSalesProspect(payload: SalesProspectPayload): Promise<SalesProspect> {
  return api("/api/v1/sales/prospects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSalesProspect(id: string, payload: Partial<SalesProspectPayload>): Promise<SalesProspect> {
  return api(`/api/v1/sales/prospects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSalesProspect(id: string): Promise<{ deleted: boolean }> {
  return api(`/api/v1/sales/prospects/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Add React Query hooks**

Append to `src/hooks/useSales.ts`:

```typescript
import {
  createSalesProspect,
  deleteSalesProspect,
  getSalesProspectSummary,
  getSalesProspects,
  updateSalesProspect,
  type SalesProspectListParams,
  type SalesProspectPayload,
} from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSalesProspects(params: SalesProspectListParams) {
  return useQuery({
    queryKey: ["sales", "prospects", params],
    queryFn: () => getSalesProspects(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useSalesProspectSummary(month?: string) {
  return useQuery({
    queryKey: ["sales", "prospects", "summary", month],
    queryFn: () => getSalesProspectSummary(month),
    staleTime: 60_000,
  });
}

export function useCreateSalesProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSalesProspect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "prospects"] }),
  });
}

export function useUpdateSalesProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SalesProspectPayload> }) =>
      updateSalesProspect(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "prospects"] }),
  });
}

export function useDeleteSalesProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSalesProspect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "prospects"] }),
  });
}
```

If duplicate import blocks are created, merge them into the existing import block at the top of `useSales.ts`.

- [ ] **Step 3: Build frontend**

Run:

```powershell
npm run build
```

Expected: Vite build exits `0`.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/api.ts src/hooks/useSales.ts
git commit -m "feat: add sales prospect frontend api"
```

---

## Task 6: Add SalesProspectsPanel UI

**Files:**
- Create: `D:\bridge-gaps-dashboard-main\src\components\sales\SalesProspectsPanel.tsx`
- Modify: `D:\bridge-gaps-dashboard-main\src\components\sales\index.ts`

- [ ] **Step 1: Create panel component**

Create a component that renders:

- Month filter
- Status filter
- Search input
- Summary cards: total prospects, pipeline value, converted value, active hot prospects
- Table columns matching Excel: month, first call, prospect, mobile, offering, proposal value, referral source, follow-up, status, reason, remarks
- Create/edit dialog with React Hook Form and Zod
- Delete action with confirmation

Use this starter structure:

```typescript
import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyINR } from "@/lib/utils";
import {
  useCreateSalesProspect,
  useDeleteSalesProspect,
  useSalesProspectSummary,
  useSalesProspects,
  useUpdateSalesProspect,
} from "@/hooks/useSales";
import type { SalesProspect, SalesProspectReason, SalesProspectStatus } from "@/lib/api";

const statuses: SalesProspectStatus[] = ["COLD", "WARM", "HOT", "CONVERTED", "REJECTED"];
const reasons: SalesProspectReason[] = ["BUDGET", "AUTHORITY", "NEED", "TIMELINE", "AVAILABILITY", "CLOSURE", "OTHER"];

const formSchema = z.object({
  month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
  firstCallAt: z.string().optional(),
  prospectName: z.string().min(2),
  mobileNumber: z.string().optional(),
  offeringType: z.string().optional(),
  proposalValue: z.coerce.number().min(0).optional(),
  referralSource: z.string().optional(),
  lastFollowUpAt: z.string().optional(),
  status: z.enum(["COLD", "WARM", "HOT", "CONVERTED", "REJECTED"]),
  reason: z.enum(["BUDGET", "AUTHORITY", "NEED", "TIMELINE", "AVAILABILITY", "CLOSURE", "OTHER"]).optional(),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const currentMonth = new Date().toISOString().slice(0, 7);

export function SalesProspectsPanel() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState<SalesProspectStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SalesProspect | null>(null);
  const [open, setOpen] = useState(false);

  const params = useMemo(
    () => ({ month, status: status === "ALL" ? undefined : status, search: search || undefined, page: 1, pageSize: 50 }),
    [month, status, search],
  );

  const prospects = useSalesProspects(params);
  const summary = useSalesProspectSummary(month);
  const createMutation = useCreateSalesProspect();
  const updateMutation = useUpdateSalesProspect();
  const deleteMutation = useDeleteSalesProspect();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { month, prospectName: "", status: "COLD" },
  });

  function startCreate() {
    setEditing(null);
    form.reset({ month, prospectName: "", status: "COLD" });
    setOpen(true);
  }

  function startEdit(prospect: SalesProspect) {
    setEditing(prospect);
    form.reset({
      month: prospect.month,
      firstCallAt: prospect.firstCallAt?.slice(0, 10) || "",
      prospectName: prospect.prospectName,
      mobileNumber: prospect.mobileNumber || "",
      offeringType: prospect.offeringType || "",
      proposalValue: prospect.proposalValue ?? 0,
      referralSource: prospect.referralSource || "",
      lastFollowUpAt: prospect.lastFollowUpAt?.slice(0, 10) || "",
      status: prospect.status,
      reason: prospect.reason || undefined,
      remarks: prospect.remarks || "",
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload: values });
      toast({ title: "Prospect updated" });
    } else {
      await createMutation.mutateAsync(values);
      toast({ title: "Prospect added" });
    }
    setOpen(false);
  }

  async function remove(id: string) {
    await deleteMutation.mutateAsync(id);
    toast({ title: "Prospect deleted" });
  }

  const rows = prospects.data?.data ?? [];
  const stats = summary.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="max-w-44" />
          <Select value={status} onValueChange={(value) => setStatus(value as SalesProspectStatus | "ALL")}>
            <SelectTrigger className="max-w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prospects" className="pl-9" />
          </div>
        </div>
        <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Add prospect</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Total prospects</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.totalProspects ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle>Pipeline value</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrencyINR(stats?.pipelineValue ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Converted value</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrencyINR(stats?.convertedValue ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Converted deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.convertedCount ?? 0}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Offering</TableHead>
                <TableHead>Proposal</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><button className="text-left font-medium" onClick={() => startEdit(row)}>{row.prospectName}</button><div className="text-xs text-muted-foreground">{row.mobileNumber}</div></TableCell>
                  <TableCell>{row.offeringType || "-"}</TableCell>
                  <TableCell>{formatCurrencyINR(row.proposalValue ?? 0)}</TableCell>
                  <TableCell>{row.lastFollowUpAt ? row.lastFollowUpAt.slice(0, 10) : "-"}</TableCell>
                  <TableCell><Badge>{row.status}</Badge></TableCell>
                  <TableCell>{row.reason || "-"}</TableCell>
                  <TableCell className="max-w-64 truncate">{row.remarks || "-"}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? "Edit prospect" : "Add prospect"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="month" render={({ field }) => (
                <FormItem><FormLabel>Month</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="firstCallAt" render={({ field }) => (
                <FormItem><FormLabel>First call</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="prospectName" render={({ field }) => (
                <FormItem><FormLabel>Prospect name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                <FormItem><FormLabel>Mobile number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="offeringType" render={({ field }) => (
                <FormItem><FormLabel>Product or service</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="proposalValue" render={({ field }) => (
                <FormItem><FormLabel>Proposal value</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="referralSource" render={({ field }) => (
                <FormItem><FormLabel>Referral source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastFollowUpAt" render={({ field }) => (
                <FormItem><FormLabel>Last follow-up</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Funnel status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger></FormControl>
                    <SelectContent>{reasons.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "Save prospect" : "Add prospect"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Export component**

Modify `src/components/sales/index.ts`:

```typescript
export { SalesProspectsPanel } from "./SalesProspectsPanel";
```

- [ ] **Step 3: Build frontend**

Run:

```powershell
npm run build
```

Expected: TypeScript errors identify any missing imports or form fields. Fix them before moving on.

- [ ] **Step 4: Commit**

```powershell
git add src/components/sales/SalesProspectsPanel.tsx src/components/sales/index.ts
git commit -m "feat: add sales prospects panel"
```

---

## Task 7: Integrate Prospects Tab Into Sales Page

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Sales.tsx`

- [ ] **Step 1: Import the panel**

Add:

```typescript
import { SalesProspectsPanel } from "@/components/sales";
```

- [ ] **Step 2: Add tab trigger and content**

Find the existing `TabsList` in `Sales.tsx` and add:

```tsx
<TabsTrigger value="prospects">Prospects</TabsTrigger>
```

Add matching content:

```tsx
<TabsContent value="prospects" className="space-y-4">
  <SalesProspectsPanel />
</TabsContent>
```

- [ ] **Step 3: Build frontend**

Run:

```powershell
npm run build
```

Expected: Vite build exits `0`.

- [ ] **Step 4: Commit**

```powershell
git add src/pages/Sales.tsx
git commit -m "feat: show prospect tracker in sales page"
```

---

## Task 8: Production Verification

**Files:**
- No source files expected.

- [ ] **Step 1: Run focused backend test**

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run backend build**

```powershell
npm run build
```

Expected: build passes.

- [ ] **Step 3: Run tenant frontend build**

```powershell
npm run build
```

Run from `D:\bridge-gaps-dashboard-main`.

Expected: build passes.

- [ ] **Step 4: Manual browser smoke**

Run backend:

```powershell
npm run start:dev
```

Run frontend:

```powershell
npm run dev
```

Open `http://localhost:8080`, log in, go to Sales, open Prospects, and verify:

- Create prospect
- Edit status from `COLD` to `HOT`
- Filter by `HOT`
- Delete prospect
- Summary cards update

- [ ] **Step 5: Record release notes**

Add a short note to the project handoff:

```markdown
Implemented tenant Sales Cycle CRM/prospect tracker matching BGAppWireframe.xlsx Sales Cycle tab. Includes tenant-scoped persistence, CRUD API, filters, summary metrics, and Sales page UI.
```

---

## Self-Review

Spec coverage:

- Sales Cycle Excel fields are covered by `SalesProspect`.
- Tenant isolation is covered by `tenantId` and `userId` query filters.
- UI placement is covered by `SalesProspectsPanel` in Sales page.
- Production verification is covered by backend tests, backend build, frontend build, and manual smoke.

Known follow-up production tracks:

- Sales Planning calculator: ASP/ATS, conversion ratio, existing/new customer contribution.
- Profile/media: profile pic, logo, one-page profile.
- Activity template catalog from Excel product/service rows.
- Notifications/reminders and Google Calendar.
- Superadmin backend consolidation and production completion.
