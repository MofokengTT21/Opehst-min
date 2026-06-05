import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
  await prisma.user.updateMany({ data: { status: 'pending_approval' } }); 
  console.log('All users set to pending_approval'); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
