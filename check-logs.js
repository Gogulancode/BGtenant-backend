// Check metric logs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const logs = await prisma.metricLog.findMany({
    include: { metric: { include: { user: true } } }
  });
  console.log("Metric Logs:");
  logs.forEach(l => console.log(`  ${l.date.toISOString().split('T')[0]} : ${l.value} - ${l.metric.user.email}`));
  await prisma.$disconnect();
}

check();
