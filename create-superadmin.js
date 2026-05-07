const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'superadmin@bg.com' }
    });

    if (existingUser) {
      // Update existing user to SUPER_ADMIN
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'SUPER_ADMIN' }
      });
      console.log('\n✅ SUPER ADMIN UPDATED!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Email:    superadmin@bg.com');
      console.log('🔑 Password: (use your existing password)');
      console.log('👤 Name:     ' + existingUser.name);
      console.log('🎭 Role:     SUPER_ADMIN');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      // Create new super admin
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'superadmin@bg.com',
          passwordHash: hashedPassword,
          name: 'Super Admin',
          businessType: 'MSME',
          role: 'SUPER_ADMIN'
        }
      });
      console.log('\n✅ SUPER ADMIN CREATED!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Email:    superadmin@bg.com');
      console.log('🔑 Password: SuperAdmin123!');
      console.log('👤 Name:     Super Admin');
      console.log('🏢 Business: MSME');
      console.log('🎭 Role:     SUPER_ADMIN');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
