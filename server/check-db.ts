import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants);
  
  const users = await prisma.user.findMany({ select: { phone: true, tenantId: true, name: true, role: true } });
  console.log('Users:', users);
  
  const hubs = await prisma.hub.findMany({ select: { name: true, tenantId: true } });
  console.log('Hubs:', hubs);
}

check().finally(() => prisma.$disconnect());
