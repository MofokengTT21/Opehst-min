import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing data (cascading deletes usually help, but manual deletion order works too)
  await prisma.reaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.hub.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Opehst Global',
    },
  });

  console.log(`Created Tenant: ${tenant.name}`);

  // 3. Create Admin User
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'System Admin',
      phone: '+1234567890',
      email: 'admin@opehst.com',
      role: 'system_admin',
    },
  });

  console.log(`Created Admin: ${admin.name}`);

  // 4. Create Hubs
  const hubNames = ['Engineering', 'Operations', 'Safety', 'Quality'];
  const hubs = [];

  for (const name of hubNames) {
    const hub = await prisma.hub.create({
      data: {
        tenantId: tenant.id,
        name,
        description: `Central hub for all ${name} related channels and posts.`,
      },
    });
    hubs.push(hub);
  }

  console.log(`Created ${hubs.length} Hubs`);

  // 5. Create Channels and Posts per Hub
  const eventTypes = [
    { name: 'Breakdown', icon: 'Wrench', color: '#ef4444' },
    { name: 'Hazard', icon: 'AlertTriangle', color: '#f59e0b' },
    { name: 'Routine', icon: 'CheckCircle', color: '#22c55e' },
    { name: 'Idea', icon: 'Lightbulb', color: '#3b82f6' }
  ];

  for (const hub of hubs) {
    for (let i = 1; i <= 3; i++) {
      const channel = await prisma.channel.create({
        data: {
          tenantId: tenant.id,
          hubId: hub.id,
          name: `${hub.name} Channel ${i}`,
          description: `Discussion for ${hub.name} topic ${i}`,
          category: i === 1 ? 'asset' : i === 2 ? 'location' : 'process',
          eventTypes,
        },
      });

      for (let j = 1; j <= 5; j++) {
        const post = await prisma.post.create({
          data: {
            tenantId: tenant.id,
            channelId: channel.id,
            authorId: admin.id,
            subject: `Update ${j} on ${channel.name}`,
            content: `This is an automated seed post for testing the global sync feature. Everything is working correctly in ${hub.name}!`,
            eventType: j % 2 === 0 ? 'Breakdown' : 'Routine',
          },
        });

        // Add a comment to the first post
        if (j === 1) {
          await prisma.comment.create({
            data: {
              tenantId: tenant.id,
              postId: post.id,
              authorId: admin.id,
              content: 'Noted. We are looking into this right away.',
            }
          });
          await prisma.reaction.create({
            data: {
              tenantId: tenant.id,
              postId: post.id,
              userId: admin.id,
              type: 'acknowledged'
            }
          });
        }
      }
    }
  }

  console.log('Successfully seeded database with Hubs, Channels, Posts, Comments, and Reactions!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
