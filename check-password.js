// Get user password hash to check
const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: "newdemo@democorp.com" }
  });
  
  if (user) {
    console.log("User found:", user.email);
    console.log("Password hash:", user.passwordHash);
    
    // Try some common passwords
    const passwords = ['demo123', 'Demo@123', 'Test@123', 'Admin@123', 'Password123', 'password'];
    for (const pwd of passwords) {
      const matches = await bcrypt.compare(pwd, user.passwordHash);
      console.log(`  ${pwd}: ${matches ? '✅ MATCHES' : '❌'}`);
    }
  } else {
    console.log("User not found");
  }
  
  await prisma.$disconnect();
}

check();
