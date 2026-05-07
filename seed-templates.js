const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTemplates() {
  console.log('Creating Metric Templates...');
  
  const metricTemplates = [
    { name: 'Daily Sales Calls', targetValue: 10, frequency: 'daily' },
    { name: 'Daily Revenue', targetValue: 25000, frequency: 'daily' },
    { name: 'New Leads Generated', targetValue: 5, frequency: 'daily' },
    { name: 'Customer Meetings', targetValue: 3, frequency: 'daily' },
    { name: 'Proposals Sent', targetValue: 2, frequency: 'daily' },
    { name: 'Emails Sent', targetValue: 20, frequency: 'daily' },
    { name: 'Weekly Revenue', targetValue: 100000, frequency: 'weekly' },
    { name: 'Weekly New Clients', targetValue: 2, frequency: 'weekly' },
    { name: 'Customer NPS Score', targetValue: 8, frequency: 'weekly' },
    { name: 'Website Visitors', targetValue: 500, frequency: 'daily' },
  ];

  for (const template of metricTemplates) {
    await prisma.metricTemplate.create({ data: template });
    console.log('  ✓ Created:', template.name);
  }

  console.log('\nCreating Outcome Templates...');
  
  const outcomeTemplates = [
    { title: 'Close a major deal', description: 'Close at least one deal worth more than target' },
    { title: 'Launch marketing campaign', description: 'Plan and launch a marketing campaign' },
    { title: 'Hire new team member', description: 'Complete hiring process for open position' },
    { title: 'Complete monthly review', description: 'Review last month performance' },
    { title: 'Update business plan', description: 'Review and update quarterly business plan' },
  ];

  for (const template of outcomeTemplates) {
    await prisma.outcomeTemplate.create({ data: template });
    console.log('  ✓ Created:', template.title);
  }

  console.log('\nCreating Activity Templates...');
  
  const activityTemplates = [
    { name: 'Follow up with leads', category: 'Sales', frequency: 'daily' },
    { name: 'Social media posting', category: 'Marketing', frequency: 'daily' },
    { name: 'Team standup meeting', category: 'Operations', frequency: 'daily' },
    { name: 'Client check-in calls', category: 'Customer Success', frequency: 'weekly' },
    { name: 'Review financials', category: 'Finance', frequency: 'weekly' },
  ];

  for (const template of activityTemplates) {
    await prisma.activityTemplate.create({ data: template });
    console.log('  ✓ Created:', template.name);
  }

  console.log('\n✅ All templates created successfully!');
  await prisma.$disconnect();
}

seedTemplates().catch(e => { 
  console.error(e); 
  prisma.$disconnect();
  process.exit(1); 
});
