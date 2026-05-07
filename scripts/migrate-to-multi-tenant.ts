import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToMultiTenant() {
  console.log('🔄 Starting multi-tenant data migration...\n');

  try {
    // 1. Create default tenant for existing data
    console.log('📦 Creating default tenant...');
    const defaultTenant = await prisma.tenant.upsert({
      where: { slug: 'default-tenant' },
      update: {},
      create: {
        name: 'Default Tenant',
        type: 'COMPANY',
        slug: 'default-tenant',
        isActive: true,
      },
    });
    console.log(`✅ Created/found tenant: ${defaultTenant.name} (${defaultTenant.id})\n`);

    // 2. Create default subscription
    console.log('💳 Creating default subscription...');
    const existingSubscription = await prisma.subscription.findFirst({
      where: { tenantId: defaultTenant.id },
    });

    if (!existingSubscription) {
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
    } else {
      console.log('✅ Subscription already exists\n');
    }

    // 3. Migrate existing users
    console.log('👥 Migrating existing users...');
    const users = await prisma.user.findMany();
    
    let superAdminCount = 0;
    let tenantUserCount = 0;

    for (const user of users) {
      // Skip if user already has correct setup
      if (user.role === Role.SUPER_ADMIN && !user.tenantId) {
        console.log(`  ⏭️  ${user.email} → Already SUPER_ADMIN (skip)`);
        superAdminCount++;
        continue;
      }
      
      if (user.tenantId === defaultTenant.id && user.role !== Role.TENANT_ADMIN) {
        console.log(`  ⏭️  ${user.email} → Already migrated (skip)`);
        tenantUserCount++;
        continue;
      }

      // Determine new role
      let newRole: Role;
      let newTenantId: string | null;

      if (user.role === Role.SUPER_ADMIN) {
        newRole = Role.SUPER_ADMIN;
        newTenantId = null;
        superAdminCount++;
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            role: newRole,
            tenantId: null,
          },
        });
        console.log(`  ✅ ${user.email} → SUPER_ADMIN (no tenant)`);
      } else {
        // All non-SUPER_ADMIN users get assigned to default tenant
        // (Migration already converted ADMIN → TENANT_ADMIN)
        newRole = user.role;
        newTenantId = defaultTenant.id;
        tenantUserCount++;

        await prisma.user.update({
          where: { id: user.id },
          data: { 
            role: newRole,
            tenantId: newTenantId,
          },
        });
        console.log(`  ✅ ${user.email} → ${newRole} (tenant: ${defaultTenant.slug})`);
      }
    }
    
    console.log(`\n✅ Migrated ${users.length} users (${superAdminCount} super admins, ${tenantUserCount} tenant users)\n`);

    // 4. Update tenant-scoped models
    console.log('📊 Updating tenant-scoped data...\n');

    // BusinessSnapshot
    const snapshots = await prisma.businessSnapshot.findMany({
      where: { tenantId: null },
    });
    for (const snapshot of snapshots) {
      await prisma.businessSnapshot.update({
        where: { id: snapshot.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${snapshots.length} business snapshots`);

    // Metrics
    const metrics = await prisma.metric.findMany({
      where: { tenantId: null },
    });
    for (const metric of metrics) {
      await prisma.metric.update({
        where: { id: metric.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${metrics.length} metrics`);

    // Outcomes
    const outcomes = await prisma.outcome.findMany({
      where: { tenantId: null },
    });
    for (const outcome of outcomes) {
      await prisma.outcome.update({
        where: { id: outcome.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${outcomes.length} outcomes`);

    // Reviews
    const reviews = await prisma.review.findMany({
      where: { tenantId: null },
    });
    for (const review of reviews) {
      await prisma.review.update({
        where: { id: review.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${reviews.length} reviews`);

    // Sales Planning
    const salesPlannings = await prisma.salesPlanning.findMany({
      where: { tenantId: null },
    });
    for (const planning of salesPlannings) {
      await prisma.salesPlanning.update({
        where: { id: planning.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${salesPlannings.length} sales plannings`);

    // Sales Tracker
    const salesTrackers = await prisma.salesTracker.findMany({
      where: { tenantId: null },
    });
    for (const tracker of salesTrackers) {
      await prisma.salesTracker.update({
        where: { id: tracker.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${salesTrackers.length} sales trackers`);

    // Activities
    const activities = await prisma.activity.findMany({
      where: { tenantId: null },
    });
    for (const activity of activities) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${activities.length} activities`);

    // Insights
    const insights = await prisma.insight.findMany({
      where: { tenantId: null },
    });
    for (const insight of insights) {
      await prisma.insight.update({
        where: { id: insight.id },
        data: { tenantId: defaultTenant.id },
      });
    }
    console.log(`  ✅ ${insights.length} insights`);

    console.log('\n🎉 Migration completed successfully!');
    console.log(`\n📋 Summary:`);
    console.log(`   - Tenant: ${defaultTenant.slug} (${defaultTenant.id})`);
    console.log(`   - Users: ${users.length} (${superAdminCount} super admins, ${tenantUserCount} tenant users)`);
    console.log(`   - Business snapshots: ${snapshots.length}`);
    console.log(`   - Metrics: ${metrics.length}`);
    console.log(`   - Outcomes: ${outcomes.length}`);
    console.log(`   - Reviews: ${reviews.length}`);
    console.log(`   - Sales plannings: ${salesPlannings.length}`);
    console.log(`   - Sales trackers: ${salesTrackers.length}`);
    console.log(`   - Activities: ${activities.length}`);
    console.log(`   - Insights: ${insights.length}`);
    console.log(`\n⚠️  NEXT STEPS:`);
    console.log(`   1. Update JWT strategy to include tenantId`);
    console.log(`   2. Add TenantGuard to all tenant controllers`);
    console.log(`   3. Update all services to filter by tenantId`);
    console.log(`   4. Test multi-tenant isolation`);
    console.log(`   5. Update frontend to handle tenantId in JWT`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateToMultiTenant()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
