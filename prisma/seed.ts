import { PrismaClient, BusinessType, TenantType, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "seed-tenant" },
    update: {},
    create: {
      name: "Seed Tenant",
      slug: "seed-tenant",
      type: TenantType.COMPANY,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash,
      businessType: BusinessType.MSME,
      tenantId: tenant.id,
      role: Role.TENANT_ADMIN,
    },
  });

  await prisma.metric.createMany({
    data: [
      { userId: user.id, tenantId: tenant.id, name: "Sales Calls", target: 20 },
      { userId: user.id, tenantId: tenant.id, name: "Marketing Posts", target: 5 },
      { userId: user.id, tenantId: tenant.id, name: "New Leads", target: 10 },
    ],
    skipDuplicates: true,
  });

  await prisma.businessSnapshot.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      annualSales: 120000,
      avgMonthlySales: 10000,
      ordersPerMonth: 50,
      avgSellingPrice: 200,
      monthlyExpenses: 8000,
      profitMargin: 20,
      suggestedNSM: "Monthly Revenue",
    },
  });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });