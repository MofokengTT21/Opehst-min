const fs = require('fs');
const files = [
  'app/app/directory.tsx',
  'app/app/admin/members.tsx',
  'app/app/admin/member-detail.tsx',
  'app/app/hubs-listing.tsx',
  'app/app/new-channel.tsx',
  'app/app/(auth)/login.tsx',
  'app/app/(drawer)/(tabs)/chats.tsx',
  'app/app/(drawer)/(tabs)/updates.tsx',
  'app/app/(drawer)/(tabs)/activity.tsx',
  'app/app/(drawer)/(tabs)/channel/[id].tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/paddingHorizontal:\s*16/g, 'paddingHorizontal: 12');
  content = content.replace(/mx-4/g, 'mx-3'); // mx-4 is safe to replace globally as it's uniquely tailwind margin class in our context
  fs.writeFileSync(file, content);
}
console.log('Padding updated globally');
