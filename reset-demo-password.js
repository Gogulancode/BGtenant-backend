// Reset demo user password
const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function resetPassword() {
  const newPassword = "Demo@123";
  const hash = await bcrypt.hash(newPassword, 10);
  
  const user = await prisma.user.update({
    where: { email: "newdemo@democorp.com" },
    data: { passwordHash: hash }
  });
  
  console.log(`✅ Password reset for ${user.email}`);
  console.log(`   New password: ${newPassword}`);
  
  await prisma.$disconnect();
}

resetPassword();
