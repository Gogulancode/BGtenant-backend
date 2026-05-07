const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Cleaning up test data...\n');

  // Delete all metric logs first (foreign key constraint)
  const logsDeleted = await prisma.metricLog.deleteMany({});
  console.log(`Deleted ${logsDeleted.count} metric logs`);

  // Delete all metrics
  const metricsDeleted = await prisma.metric.deleteMany({});
  console.log(`Deleted ${metricsDeleted.count} metrics`);

  // Delete all outcomes
  const outcomesDeleted = await prisma.outcome.deleteMany({});
  console.log(`Deleted ${outcomesDeleted.count} outcomes`);

  // Delete all activities
  const activitiesDeleted = await prisma.activity.deleteMany({});
  console.log(`Deleted ${activitiesDeleted.count} activities`);

  console.log('\n✅ Cleanup complete! You can now test templates fresh.');

  // Show available templates
  const metricTemplates = await prisma.metricTemplate.findMany();
  const outcomeTemplates = await prisma.outcomeTemplate.findMany();
  const activityTemplates = await prisma.activityTemplate.findMany();

  console.log('\n📋 Available Templates:');
  console.log(`   - ${metricTemplates.length} Metric Templates`);
  console.log(`   - ${outcomeTemplates.length} Outcome Templates`);
  console.log(`   - ${activityTemplates.length} Activity Templates`);

  if (metricTemplates.length > 0) {
    console.log('\nMetric Templates:');
    metricTemplates.forEach(t => console.log(`   • ${t.name}`));
  }

  if (outcomeTemplates.length > 0) {
    console.log('\nOutcome Templates:');
    outcomeTemplates.forEach(t => console.log(`   • ${t.title}`));
  }

  if (activityTemplates.length > 0) {
    console.log('\nActivity Templates:');
    activityTemplates.forEach(t => console.log(`   • ${t.name}`));
  }
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
