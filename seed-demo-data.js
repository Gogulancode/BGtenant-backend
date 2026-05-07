/**
 * Seed Demo Data Script
 * 
 * This script adds sample data to the database for demonstration purposes.
 * Run with: node seed-demo-data.js <user-email>
 * 
 * Example: node seed-demo-data.js admin@example.com
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function seedDemoData(userEmail) {
  console.log(`\n🔍 Looking for user: ${userEmail}\n`);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { tenant: true },
  });

  if (!user) {
    console.error(`❌ User not found: ${userEmail}`);
    console.log("\nAvailable users:");
    const users = await prisma.user.findMany({ select: { email: true, name: true } });
    users.forEach((u) => console.log(`  - ${u.email} (${u.name})`));
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name} (${user.email})`);
  console.log(`   Tenant: ${user.tenant?.name || "No tenant"}`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Tenant ID: ${user.tenantId}\n`);

  const userId = user.id;
  const tenantId = user.tenantId;

  if (!tenantId) {
    console.error("❌ User has no tenant assigned!");
    process.exit(1);
  }

  // Get current date info
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday

  console.log("📊 Creating Metrics...");
  
  // Create Metrics
  const metricsData = [
    { name: "Sales Calls", target: 20 },
    { name: "Client Meetings", target: 10 },
    { name: "Proposals Sent", target: 5 },
    { name: "Follow-ups", target: 15 },
    { name: "New Leads", target: 8 },
  ];

  const metrics = [];
  for (const m of metricsData) {
    const metric = await prisma.metric.upsert({
      where: {
        id: `${userId}-${m.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: { target: m.target },
      create: {
        id: `${userId}-${m.name.toLowerCase().replace(/\s+/g, "-")}`,
        userId,
        tenantId,
        name: m.name,
        target: m.target,
      },
    });
    metrics.push(metric);
    console.log(`   ✓ ${m.name} (target: ${m.target})`);
  }

  console.log("\n📈 Logging Metric Values (last 7 days)...");

  // Add metric logs for the past 7 days
  for (const metric of metrics) {
    for (let i = 6; i >= 0; i--) {
      const logDate = new Date(today);
      logDate.setDate(today.getDate() - i);
      
      // Random value between 50-120% of target
      const target = metric.target || 10;
      const value = Math.floor(target * (0.5 + Math.random() * 0.7));

      await prisma.metricLog.create({
        data: {
          metricId: metric.id,
          value,
          date: logDate,
        },
      });
    }
    console.log(`   ✓ ${metric.name}: 7 days of logs`);
  }

  console.log("\n🎯 Creating Outcomes...");

  // Create Outcomes for current week
  const outcomesData = [
    { title: "Close 3 new deals", status: "Done" },
    { title: "Launch email campaign", status: "Done" },
    { title: "Complete product demo", status: "Done" },
    { title: "Review quarterly targets", status: "Planned" },
    { title: "Update CRM records", status: "Planned" },
  ];

  for (const o of outcomesData) {
    await prisma.outcome.create({
      data: {
        userId,
        tenantId,
        title: o.title,
        status: o.status,
        weekStartDate: weekStart,
      },
    });
    console.log(`   ✓ ${o.title} (${o.status})`);
  }

  // Create some outcomes for last week too
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  
  const lastWeekOutcomes = [
    { title: "Prepare Q1 report", status: "Done" },
    { title: "Team training session", status: "Done" },
    { title: "Client onboarding call", status: "Done" },
    { title: "Website update", status: "Missed" },
  ];

  for (const o of lastWeekOutcomes) {
    await prisma.outcome.create({
      data: {
        userId,
        tenantId,
        title: o.title,
        status: o.status,
        weekStartDate: lastWeekStart,
      },
    });
  }
  console.log(`   ✓ 4 outcomes from last week`);

  console.log("\n💼 Creating Activities...");

  // Create Activities
  const activitiesData = [
    { title: "Prepare investor pitch deck", category: "Sales", priority: "High", status: "Completed" },
    { title: "Follow up with ABC Corp", category: "Sales", priority: "High", status: "Completed" },
    { title: "Social media content calendar", category: "Marketing", priority: "Medium", status: "Completed" },
    { title: "Product roadmap review", category: "Product", priority: "High", status: "Active" },
    { title: "Team standup meeting", category: "Operations", priority: "Medium", status: "Active" },
    { title: "Customer feedback analysis", category: "Product", priority: "Medium", status: "Active" },
    { title: "Update pricing page", category: "Marketing", priority: "Low", status: "Active" },
    { title: "Quarterly planning session", category: "Operations", priority: "High", status: "Completed" },
  ];

  for (const a of activitiesData) {
    await prisma.activity.create({
      data: {
        userId,
        tenantId,
        title: a.title,
        category: a.category,
        priority: a.priority,
        status: a.status,
        createdAt: new Date(today.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`   ✓ ${a.title} (${a.category})`);
  }

  console.log("\n📝 Creating Reviews...");

  // Create Daily Reviews for past 5 days
  for (let i = 4; i >= 0; i--) {
    const reviewDate = new Date(today);
    reviewDate.setDate(today.getDate() - i);

    await prisma.review.create({
      data: {
        userId,
        tenantId,
        type: "Daily",
        mood: Math.floor(3 + Math.random() * 3), // 3-5
        content: `Productive day! Completed ${Math.floor(3 + Math.random() * 5)} tasks.`,
        wins: "Made progress on key initiatives",
        challenges: "Time management could be better",
        date: reviewDate,
      },
    });
  }
  console.log("   ✓ 5 daily reviews");

  // Create Weekly Review
  await prisma.review.create({
    data: {
      userId,
      tenantId,
      type: "Weekly",
      mood: 4,
      content: "Great week overall. Hit most targets.",
      wins: "Closed 2 major deals, launched new campaign",
      challenges: "Need to improve delegation",
      lessons: "Focus on high-impact activities",
      date: weekStart,
    },
  });
  console.log("   ✓ 1 weekly review");

  console.log("\n💰 Creating Sales Data...");

  // Create Sales Planning
  const currentYear = now.getFullYear();
  await prisma.salesPlanning.upsert({
    where: {
      tenantId_userId_year: { tenantId, userId, year: currentYear },
    },
    update: {},
    create: {
      userId,
      tenantId,
      year: currentYear,
      q1: 500000,
      q2: 600000,
      q3: 700000,
      q4: 800000,
      growthPct: 25,
    },
  });
  console.log(`   ✓ Sales plan for ${currentYear}`);

  // Create Sales Tracker for recent months
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  for (const month of months) {
    const target = 150000 + Math.floor(Math.random() * 50000);
    const achieved = target * (0.7 + Math.random() * 0.4);

    await prisma.salesTracker.upsert({
      where: {
        tenantId_userId_month: { tenantId, userId, month },
      },
      update: {},
      create: {
        userId,
        tenantId,
        month,
        target,
        achieved: Math.floor(achieved),
        orders: Math.floor(10 + Math.random() * 20),
        asp: Math.floor(5000 + Math.random() * 5000),
      },
    });
    console.log(`   ✓ Sales tracker for ${month}`);
  }

  console.log("\n🧠 Creating/Updating Insight...");

  // Calculate and create Insight
  const completedOutcomes = await prisma.outcome.count({
    where: { userId, tenantId, status: "Done" },
  });
  const totalOutcomes = await prisma.outcome.count({
    where: { userId, tenantId },
  });
  const completionRate = totalOutcomes > 0 ? (completedOutcomes / totalOutcomes) * 100 : 0;

  // Simple momentum calculation
  const momentumScore = Math.min(100, Math.floor(completionRate * 0.5 + 50));
  const streakCount = 5; // Simulated streak

  await prisma.insight.upsert({
    where: { userId },
    update: {
      momentumScore,
      streakCount,
      flags: momentumScore >= 70 ? "Green" : momentumScore >= 40 ? "Yellow" : "Red",
    },
    create: {
      userId,
      tenantId,
      momentumScore,
      streakCount,
      flags: momentumScore >= 70 ? "Green" : momentumScore >= 40 ? "Yellow" : "Red",
    },
  });
  console.log(`   ✓ Momentum: ${momentumScore}%, Streak: ${streakCount} days, Flag: ${momentumScore >= 70 ? "Green" : "Yellow"}`);

  console.log("\n" + "=".repeat(50));
  console.log("✅ DEMO DATA SEEDED SUCCESSFULLY!");
  console.log("=".repeat(50));
  console.log("\nData created:");
  console.log(`  • ${metrics.length} Metrics with 7 days of logs each`);
  console.log(`  • ${outcomesData.length + lastWeekOutcomes.length} Outcomes (current + last week)`);
  console.log(`  • ${activitiesData.length} Activities`);
  console.log(`  • 6 Reviews (5 daily + 1 weekly)`);
  console.log(`  • Sales planning for ${currentYear}`);
  console.log(`  • Sales tracker for ${months.length} months`);
  console.log(`  • Insight/Momentum calculated`);
  console.log("\n🎉 Refresh your dashboard to see the data!\n");
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log("\n❌ Usage: node seed-demo-data.js <user-email>");
  console.log("   Example: node seed-demo-data.js admin@example.com\n");
  process.exit(1);
}

seedDemoData(email)
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
