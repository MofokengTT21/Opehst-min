const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) return;
  const channels = await prisma.channel.findMany({ where: { tenantId: admin.tenantId } });
  
  for (const ch of channels) {
    const existing = await prisma.channelMember.findFirst({
      where: { userId: admin.id, channelId: ch.id }
    });
    if (!existing) {
      await prisma.channelMember.create({
        data: { userId: admin.id, channelId: ch.id, tenantId: admin.tenantId, role: 'admin' }
      });
    }
  }
  console.log('Admin backfilled to existing channels');
}
main().finally(() => prisma.$disconnect());
