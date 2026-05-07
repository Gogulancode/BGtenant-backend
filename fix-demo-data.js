const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDemoData() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'newdemo@democorp.com' }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User:', user.id);
    console.log('Tenant:', user.tenantId);
    
    // Get current week's Monday (using local time)
    const today = new Date();
    console.log('Today:', today.toISOString());
    
    // Calculate Monday of current week
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    console.log('Week starts (Monday):', monday.toISOString());

    // Check existing outcomes
    const existingOutcomes = await prisma.outcome.findMany({
      where: { userId: user.id, tenantId: user.tenantId },
      orderBy: { weekStartDate: 'desc' }
    });
    
    console.log('\nExisting outcomes:', existingOutcomes.length);
    existingOutcomes.slice(0, 5).forEach(o => {
      console.log(`  - ${o.title} | Week: ${o.weekStartDate.toISOString().split('T')[0]} | Status: ${o.status}`);
    });

    // Delete old outcomes and create fresh ones for this week
    await prisma.outcome.deleteMany({
      where: { userId: user.id, tenantId: user.tenantId }
    });
    console.log('\n✅ Cleared old outcomes');

    // Create outcomes for this week
    const thisWeekOutcomes = [
      { title: 'Close 3 new deals', status: 'Done' },
      { title: 'Launch email campaign', status: 'Done' },
      { title: 'Complete product demo', status: 'Done' },
      { title: 'Review quarterly targets', status: 'Planned' },
      { title: 'Update CRM records', status: 'Planned' },
    ];

    for (const outcome of thisWeekOutcomes) {
      await prisma.outcome.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          title: outcome.title,
          status: outcome.status,
          weekStartDate: monday
        }
      });
    }
    console.log('✅ Created', thisWeekOutcomes.length, 'outcomes for this week');

    // Verify
    const newOutcomes = await prisma.outcome.findMany({
      where: { userId: user.id, tenantId: user.tenantId, weekStartDate: monday }
    });
    console.log('\nThis week outcomes:');
    newOutcomes.forEach(o => {
      console.log(`  - ${o.title}: ${o.status}`);
    });

    // Now the momentum should calculate correctly:
    // Outcome score: 3 done / 5 total = 60% * 50 = 30 points
    // Activity score: need active days
    
    console.log('\n📊 Expected momentum calculation:');
    console.log('  Outcomes: 3/5 done = 60% → 30 points');
    console.log('  Activities: Need metric logs for active days');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDemoData();
