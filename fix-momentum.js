// Script to fix momentum for demo user by adding metric logs for active days
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixMomentum() {
  try {
    // Find the demo user
    const user = await prisma.user.findFirst({
      where: { email: "newdemo@democorp.com" },
    });

    if (!user) {
      console.log("❌ Demo user not found");
      return;
    }

    console.log(`\n📧 Found user: ${user.email}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`🏢 Tenant ID: ${user.tenantId}`);

    // Find or create a metric for this user
    let metric = await prisma.metric.findFirst({
      where: { userId: user.id },
    });

    if (!metric) {
      console.log("\n📊 No metrics found, creating one...");
      metric = await prisma.metric.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          name: "Revenue",
          target: 100000,
        },
      });
      console.log(`✅ Created metric: ${metric.name}`);
    } else {
      console.log(`\n📊 Found metric: ${metric.name}`);
    }

    // Get current week's Monday
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);

    console.log(`\n📅 Current week starts: ${monday.toISOString().split('T')[0]}`);

    // Delete existing logs for this week to avoid duplicates
    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    await prisma.metricLog.deleteMany({
      where: {
        metricId: metric.id,
        date: {
          gte: monday,
          lt: weekEnd,
        },
      },
    });

    // Create metric logs for each day of the current week (5 active days)
    const logs = [];
    for (let i = 0; i < 5; i++) {
      const logDate = new Date(monday);
      logDate.setDate(monday.getDate() + i);
      logDate.setHours(10, 0, 0, 0); // 10 AM

      logs.push({
        metricId: metric.id,
        value: 5000 + (i * 1000), // Increasing values
        date: logDate,
      });
    }

    // Create the logs
    for (const log of logs) {
      await prisma.metricLog.create({ data: log });
      console.log(`✅ Created log: ${log.date.toISOString().split('T')[0]} = ${log.value}`);
    }

    console.log(`\n🎯 Created ${logs.length} metric logs for current week`);

    // Verify outcome status
    const outcomes = await prisma.outcome.findMany({
      where: {
        userId: user.id,
        weekStartDate: {
          gte: monday,
          lt: weekEnd,
        },
      },
    });

    console.log(`\n📋 Current week outcomes:`);
    outcomes.forEach(o => {
      console.log(`   - ${o.title}: ${o.status}`);
    });

    const completedOutcomes = outcomes.filter(o => o.status === 'Done').length;
    const totalOutcomes = outcomes.length;
    const outcomeRate = totalOutcomes > 0 ? (completedOutcomes / totalOutcomes) * 100 : 0;
    const outcomeScore = (outcomeRate / 100) * 50; // 50% weight

    console.log(`\n📊 Momentum calculation preview:`);
    console.log(`   Outcomes: ${completedOutcomes}/${totalOutcomes} = ${outcomeRate.toFixed(1)}%`);
    console.log(`   Outcome Score: ${outcomeScore.toFixed(1)} (out of 50)`);
    console.log(`   Active Days: 5/7 = ${((5/7)*100).toFixed(1)}%`);
    console.log(`   Activity Score: ${((5/7)*50).toFixed(1)} (out of 50)`);
    console.log(`   Expected Momentum: ${(outcomeScore + (5/7)*50).toFixed(1)}%`);
    console.log(`\n✅ Data fixed! The insights endpoint will now calculate momentum dynamically.`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMomentum();
