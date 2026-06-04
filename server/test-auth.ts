import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const phone = '+27671521862';
  
  // 1. Request OTP
  const reqRes = await fetch('http://localhost:3000/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  console.log('Request OTP:', await reqRes.json());
  
  // 2. Get OTP from DB
  const otpRecord = await prisma.otpVerification.findUnique({ where: { phone } });
  if (!otpRecord) {
    console.log('No OTP record found');
    return;
  }
  
  // 3. Verify OTP
  const verifyRes = await fetch('http://localhost:3000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: otpRecord.code })
  });
  const verifyData: any = await verifyRes.json();
  console.log('Verify OTP:', verifyData);
  
  const token = verifyData.session?.access_token;
  if (!token) {
    console.log('No access token returned!');
    return;
  }
  
  // 4. Fetch Hubs
  const hubsRes = await fetch('http://localhost:3000/api/feed/hubs', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const hubs = await hubsRes.json();
  console.log('Hubs:', hubs);

  // 5. Fetch Channels
  const channelsRes = await fetch('http://localhost:3000/api/feed/channels', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const channels = await channelsRes.json();
  console.log('Channels:', channels);
}

test().finally(() => prisma.$disconnect());
