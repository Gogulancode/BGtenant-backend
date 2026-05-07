const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateMomentum() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'newdemo@democorp.com' }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User ID:', user.id);
    console.log('Tenant ID:', user.tenantId);

    // Get current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    console.log('Current week starts:', monday.toISOString());

    // Update current week's outcomes to Done
    const updatedOutcomes = await prisma.outcome.updateMany({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        weekStartDate: {
          gte: monday,
          lt: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      data: {
        status: 'Done'
      }
    });
    console.log('✅ Updated outcomes to Done:', updatedOutcomes.count);

    // Add metric logs for the past 5 days to show activity
    const metrics = await prisma.metric.findMany({
      where: { userId: user.id, tenantId: user.tenantId },
      take: 3
    });
    
    for (const metric of metrics) {
      for (let i = 0; i < 5; i++) {
        const logDate = new Date();
        logDate.setDate(logDate.getDate() - i);
        logDate.setHours(10 + i, 0, 0, 0);
        
        await prisma.metricLog.upsert({
          where: {
            id: `demo-${metric.id}-${logDate.toISOString().split('T')[0]}`
          },
          update: {
            value: Math.floor(Math.random() * 10) + 5
          },
          create: {
            id: `demo-${metric.id}-${logDate.toISOString().split('T')[0]}`,
            metricId: metric.id,
            value: Math.floor(Math.random() * 10) + 5,
            date: logDate
          }
        });
      }
    }
    console.log('✅ Added metric logs for past 5 days');

    // Update insight record
    const insight = await prisma.insight.upsert({
      where: { userId: user.id },
      update: {
        momentumScore: 78,
        flags: 'Green',
        streakCount: 12,
      },
      create: {
        userId: user.id,
        tenantId: user.tenantId,
        momentumScore: 78,
        flags: 'Green',
        streakCount: 12,
      }
    });
    
    console.log('✅ Updated insight:', JSON.stringify(insight, null, 2));
    
    // Verify outcomes
    const thisWeekOutcomes = await prisma.outcome.findMany({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        weekStartDate: {
          gte: monday
        }
      },
      select: { title: true, status: true, weekStartDate: true }
    });
    console.log('\\nThis week outcomes:');
    thisWeekOutcomes.forEach(o => console.log(`  - ${o.title}: ${o.status}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMomentum();
