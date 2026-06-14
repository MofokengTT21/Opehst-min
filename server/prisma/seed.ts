import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with realistic Smelting Processing data...');

  // 1. Clean existing data
  await prisma.deletedRecord.deleteMany({});
  await prisma.permitToWork.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.reaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.hub.deleteMany({});
  await prisma.inviteCode.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Titanium Smelting Corp',
    },
  });

  console.log(`Created Tenant: ${tenant.name}`);

  // 3. Create Admin User
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Plant Manager',
      phone: '+27671521862',
      email: 'manager@titaniumsmelting.com',
      role: 'admin', // Ensure role matches the system
      status: 'active', // So the seed works natively
    },
  });

  console.log(`Created Admin: ${admin.name}`);

  // 4. Create Hubs
  const hubNames = ['Furnace Operations', 'Casting Plant', 'Maintenance', 'Safety & Environment'];
  const hubs = [];

  for (const name of hubNames) {
    const hub = await prisma.hub.create({
      data: {
        tenantId: tenant.id,
        name,
        description: `Central hub for all ${name} operations and reporting.`,
      },
    });
    hubs.push(hub);
  }

  console.log(`Created ${hubs.length} Hubs`);

  // 5. Create Channels and Posts per Hub
  const eventTypes = [
    { name: 'Hazard', icon: 'warning', color: '#f59e0b' },
    { name: 'Fault', icon: 'build', color: '#ef4444' },
    { name: 'Inspection', icon: 'checkmark-circle', color: '#22c55e' },
    { name: 'Shift Handover', icon: 'swap-horizontal', color: '#06b6d4' },
    { name: 'Idea', icon: 'bulb', color: '#8b5cf6' }
  ];

  const channelsData = [
    // Furnace Operations
    [
      { name: 'Electric Arc Furnace A', category: 'asset' },
      { name: 'Slag Tapping Area', category: 'location' },
      { name: 'Electrode Addition', category: 'process' }
    ],
    // Casting Plant
    [
      { name: 'Continuous Caster 1', category: 'asset' },
      { name: 'Cooling Bed', category: 'location' },
      { name: 'Billet Cutting', category: 'process' }
    ],
    // Maintenance
    [
      { name: 'Hydraulic Systems', category: 'asset' },
      { name: 'Overhead Cranes', category: 'asset' },
      { name: 'Preventative Maint Schedule', category: 'process' }
    ],
    // Safety & Environment
    [
      { name: 'Gas Extraction System', category: 'asset' },
      { name: 'Plant Perimeter', category: 'location' },
      { name: 'Incident Reporting', category: 'process' }
    ]
  ];

  const postsData = [
    { subject: 'Tap Hole Blockage', content: 'Furnace A tap hole is showing signs of refractory wear and partial blockage. Flow rate reduced by 15%. Scheduled oxygen lancing for next shift.', eventType: 'Fault' },
    { subject: 'Shift Handover: Day to Night', content: 'All parameters normal. Temperature holding at 1650°C. Slag basicity ratio is 1.2. Keep an eye on electrode 3 slipping mechanism.', eventType: 'Shift Handover' },
    { subject: 'Hydraulic Pressure Drop', content: 'Noticed a 5 bar pressure drop on the secondary cooling circuit hydraulic pump. No visible leaks. Requesting mechanical inspection.', eventType: 'Hazard' },
    { subject: 'Routine Crane Inspection', content: 'Overhead crane 2 wire ropes inspected and lubricated. Brakes tested and operating within limits. Next inspection due in 30 days.', eventType: 'Inspection' },
    { subject: 'Optimization Idea: Scrap Pre-heating', content: 'If we utilize the exhaust gas to pre-heat the scrap bucket before charging, we could reduce tap-to-tap time by 5 mins.', eventType: 'Idea' }
  ];

  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i];
    const hubChannels = channelsData[i];

    for (let j = 0; j < hubChannels.length; j++) {
      const channelData = hubChannels[j];
      const channel = await prisma.channel.create({
        data: {
          tenantId: tenant.id,
          hubId: hub.id,
          name: channelData.name,
          description: `Discussions and updates for ${channelData.name}`,
          category: channelData.category,
          eventTypes,
        },
      });

      await prisma.channelMember.create({
        data: {
          tenantId: tenant.id,
          channelId: channel.id,
          userId: admin.id,
          role: 'admin'
        }
      });

      // Add 2-3 realistic posts to each channel
      const numPosts = Math.floor(Math.random() * 2) + 2;
      for (let k = 0; k < numPosts; k++) {
        // Pick a random post template
        const postTemplate = postsData[Math.floor(Math.random() * postsData.length)];
        
        const post = await prisma.post.create({
          data: {
            tenantId: tenant.id,
            channelId: channel.id,
            authorId: admin.id,
            subject: postTemplate.subject,
            content: postTemplate.content,
            eventType: postTemplate.eventType,
          },
        });

        // Add a comment to some posts
        if (k === 0) {
          const firstComment = await prisma.comment.create({
            data: {
              tenantId: tenant.id,
              postId: post.id,
              authorId: admin.id,
              content: 'Noted. Maintenance team has been notified and will prioritize this during the upcoming shutdown.',
            }
          });
          
          // Like the comment
          await prisma.reaction.create({
            data: {
              tenantId: tenant.id,
              postId: post.id, // Keeping post id just in case
              commentId: firstComment.id,
              userId: admin.id,
              type: 'heart'
            }
          });

          // Reply to the comment (Quote)
          await prisma.comment.create({
            data: {
              tenantId: tenant.id,
              postId: post.id,
              authorId: admin.id,
              content: 'Thanks, please keep us updated!',
              quotedCommentId: firstComment.id
            }
          });
        }
      }
    }
  }

  console.log('Successfully seeded database with realistic Smelting Processing data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
