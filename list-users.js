const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.user.findMany({ select: { email: true, name: true } })
  .then(users => {
    console.log('Users in database:');
    users.forEach(u => console.log(`  - ${u.email} (${u.name})`));
    p.$disconnect();
  })
  .catch(e => {
    console.error(e);
    p.$disconnect();
  });
