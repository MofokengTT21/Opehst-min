const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.user.updateMany({
    where: { role: 'admin' },
    data: { status: 'active' }
  });
  console.log('Admin activated');
}
main().finally(() => prisma.$disconnect());
