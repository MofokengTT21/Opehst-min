import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import africastalking from 'africastalking';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const AT_API_KEY = process.env.AT_API_KEY || 'sandbox';
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'mock-jwt-secret-for-development';

// Initialize Africa's Talking
const at = africastalking({
  apiKey: AT_API_KEY,
  username: AT_USERNAME
});
const sms = at.SMS;

// Helper to generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Route 1: Request OTP
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await prisma.otpVerification.upsert({
      where: { phone },
      update: {
        code,
        attempts: 0,
        expiresAt
      },
      create: {
        phone,
        code,
        attempts: 0,
        expiresAt
      }
    });

    // Send the SMS natively if we have a real key, otherwise mock it for local dev
    if (AT_API_KEY !== 'your_africas_talking_api_key' && AT_API_KEY !== 'sandbox') {
      try {
        await sms.send({
          to: [phone],
          message: `Your Opehst code is ${code}`
        });
        console.log(`OTP sent securely to ${phone}`);
      } catch (err) {
        console.error('Africa Talking API Error:', err);
      }
    } else {
      console.log(`\n[MOCK OTP DELIVERED] Code for ${phone} is: ${code}\n`);
    }

    res.json({ success: true, message: 'OTP requested successfully' });
  } catch (error) {
    console.error('Error in request-otp:', error);
    res.status(500).json({ error: 'Failed to request OTP' });
  }
});

// Route 2: Verify OTP and Generate Supabase-compatible JWT
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  try {
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { phone }
    });

    if (!otpRecord) {
      return res.status(404).json({ error: 'No active OTP request found for this number' });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 3) {
      return res.status(403).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.code !== code) {
      await prisma.otpVerification.update({
        where: { phone },
        data: { attempts: otpRecord.attempts + 1 }
      });
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // OTP is valid! Clean up the record to prevent replay attacks
    await prisma.otpVerification.delete({
      where: { phone }
    });

    // Lookup user
    let user = await prisma.user.findUnique({
      where: { phone }
    });

    // For MVP / Local Development: Auto-provision user if they don't exist
    if (!user) {
      const defaultTenant = await prisma.tenant.findFirst() || await prisma.tenant.create({
        data: { name: 'Opehst Primary Tenant' }
      });

      user = await prisma.user.create({
        data: {
          phone,
          name: 'Artisan User',
          role: 'user', 
          tenantId: defaultTenant.id
        }
      });
    }

    // Generate fully Supabase-compatible JWT payload
    const payload = {
      sub: user.id,
      role: 'authenticated', // Exact string required by Supabase
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour access token
      app_metadata: {
        tenant_id: user.tenantId,
        user_role: user.role
      }
    };

    const accessToken = jwt.sign(payload, JWT_SECRET);
    
    // Refresh token with longer expiry (30 days)
    const refreshPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) };
    const refreshToken = jwt.sign(refreshPayload, JWT_SECRET);

    res.json({
      success: true,
      user,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

export default router;
