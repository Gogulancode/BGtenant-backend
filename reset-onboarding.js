const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const result = await prisma.onboardingProgress.updateMany({
      data: {
        isCompleted: false,
        profileCompleted: false,
        businessIdentityCompleted: false,
        salesPlanCompleted: false,
        activityConfigCompleted: false,
        salesCycleCompleted: false,
        achievementStagesCompleted: false,
        subscriptionCompleted: false,
        visualSetupCompleted: false,
        currentStep: 1
      }
    });
    
    console.log('Onboarding reset successfully!');
    console.log('Records updated:', result.count);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
