const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Delete all refresh tokens to force re-login
    const result = await prisma.refreshToken.deleteMany({});
    
    console.log('Sessions cleared successfully!');
    console.log('Tokens deleted:', result.count);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
