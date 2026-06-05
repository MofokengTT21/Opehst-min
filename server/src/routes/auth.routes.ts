import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import africastalking from 'africastalking';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { io } from '../index';

const router = Router();

// ─── Rate Limiters ──────────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 OTP requests per `window`
  message: { error: 'Too many OTP requests from this IP, please try again after 10 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Limit each IP to 10 verify attempts
  message: { error: 'Too many verify attempts, please try again after 10 minutes' },
});

const provisionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit to 5 provisions per hour per IP
  message: { error: 'Too many provisioning requests, please try again later' },
});
const prisma = new PrismaClient();

const AT_API_KEY = process.env.AT_API_KEY || 'sandbox';
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'mock-jwt-secret-for-development';

// Initialize Africa's Talking
const at = africastalking({ apiKey: AT_API_KEY, username: AT_USERNAME });
const sms = at.SMS;

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/** Builds a LIMITED JWT (no tenant, used for pending_org / pending_approval) */
function issueLimitedJWT(userId: string, status: string) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: userId,
      status,
      role: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + 60 * 60 * 24, // 24h — user has time to complete onboarding
    },
    JWT_SECRET
  );
}

/** Builds a FULL JWT (includes tenant_id and user role, issued on approval) */
function issueFullJWT(userId: string, tenantId: string, role: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    status: 'active',
    role: 'authenticated',
    iss: 'supabase',
    iat: now,
    exp: now + 60 * 60 * 24 * 30, // 30 days access token for dev
    app_metadata: { tenant_id: tenantId, user_role: role },
  };
  const accessToken = jwt.sign(payload, JWT_SECRET);
  const refreshToken = jwt.sign(
    { ...payload, exp: now + 60 * 60 * 24 * 30 },
    JWT_SECRET
  );
  return { accessToken, refreshToken };
}

/** Middleware: verify JWT and attach decoded payload to req */
function requireAuth(req: Request, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** Middleware: require admin role */
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (user?.app_metadata?.user_role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── Part A: OTP Flow ────────────────────────────────────────────────────────

// POST /api/auth/request-otp
router.post('/request-otp', otpLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  try {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpVerification.upsert({
      where: { phone },
      update: { code, attempts: 0, expiresAt },
      create: { phone, code, attempts: 0, expiresAt },
    });

    if (AT_API_KEY !== 'your_africas_talking_api_key' && AT_API_KEY !== 'sandbox') {
      try {
        await sms.send({ to: [phone], message: `Your Opehst code is ${code}` });
        console.log(`OTP sent securely to ${phone}`);
      } catch (err) {
        console.error('Africa Talking API Error:', err);
      }
    } else {
      console.log(`\n[MOCK OTP] Code for ${phone}: ${code}\n`);
    }

    res.json({ success: true, message: 'OTP requested successfully' });
  } catch (error) {
    console.error('Error in request-otp:', error);
    res.status(500).json({ error: 'Failed to request OTP' });
  }
});

// POST /api/auth/verify-otp
// Creates user with status: pending_org, no tenant. Issues LIMITED JWT.
router.post('/verify-otp', verifyLimiter, async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  try {
    const otpRecord = await prisma.otpVerification.findUnique({ where: { phone } });
    if (!otpRecord) return res.status(404).json({ error: 'No active OTP request found' });
    if (new Date() > otpRecord.expiresAt) return res.status(400).json({ error: 'OTP has expired' });
    if (otpRecord.attempts >= 3) return res.status(403).json({ error: 'Too many attempts. Request a new OTP.' });
    if (otpRecord.code !== code) {
      await prisma.otpVerification.update({
        where: { phone },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Clean up OTP
    await prisma.otpVerification.delete({ where: { phone } });

    // Find or create user — no tenant assigned yet
    let user = await prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;
    if (!user) {
      user = await prisma.user.create({
        data: { phone, role: 'user', status: 'pending_org' },
      });
    }

    let accessToken: string;
    let refreshToken: string;

    if (user.status === 'active' && user.tenantId) {
      const tokens = issueFullJWT(user.id, user.tenantId, user.role);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    } else {
      accessToken = issueLimitedJWT(user.id, user.status);
      refreshToken = issueLimitedJWT(user.id, user.status);
    }

    res.json({
      success: true,
      isNewUser,
      user: { id: user.id, phone: user.phone, name: user.name, status: user.status },
      session: { access_token: accessToken, refresh_token: refreshToken },
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// POST /api/auth/profile
// Save name after OTP (Part A end-state)
const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(50, 'Name is too long').regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters'),
});

router.post('/profile', requireAuth, async (req, res) => {
  const userId = (req as any).user.sub;
  
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { name } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) return res.status(404).json({ error: 'User not found' });

    let newStatus = existingUser.status;
    if (newStatus === 'invited_to_org') {
      newStatus = 'pending_approval';
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim(), status: newStatus },
    });

    let accessToken, refreshToken;
    if (newStatus !== existingUser.status) {
      accessToken = issueLimitedJWT(user.id, newStatus);
      refreshToken = issueLimitedJWT(user.id, newStatus);
    }

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        status: user.status,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenantId
      },
      session: accessToken ? { access_token: accessToken, refresh_token: refreshToken } : undefined
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Staff: Provision Organisation ───────────────────────────────────────────

// POST /api/auth/provision
// Opehst internal tool: Creates tenant and pre-registers admin phone with an auth code.
router.post('/provision', provisionLimiter, async (req, res) => {
  const { orgName, adminPhone } = req.body;
  if (!orgName?.trim() || !adminPhone?.trim()) {
    return res.status(400).json({ error: 'Organisation name and admin phone are required' });
  }

  // Generate a 6-character auth code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let authCode = '';
  for (let i = 0; i < 6; i++) {
    authCode += chars[Math.floor(Math.random() * chars.length)];
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create Tenant
      const tenant = await tx.tenant.create({
        data: { name: orgName.trim() },
      });

      // Upsert User
      const user = await tx.user.upsert({
        where: { phone: adminPhone.trim() },
        create: {
          phone: adminPhone.trim(),
          tenantId: tenant.id,
          role: 'admin',
          status: 'pending_admin_auth',
          adminAuthCode: authCode,
        },
        update: {
          tenantId: tenant.id,
          role: 'admin',
          status: 'pending_admin_auth',
          adminAuthCode: authCode,
        },
      });

      return { tenant, user };
    });

    res.json({
      success: true,
      authCode,
      tenant: { id: result.tenant.id, name: result.tenant.name },
    });
  } catch (error) {
    console.error('Provisioning error:', error);
    res.status(500).json({ error: 'Failed to provision organisation' });
  }
});

// ─── Client Admin: Verify Auth Code ──────────────────────────────────────────

// POST /api/auth/verify-admin-auth
router.post('/verify-admin-auth', requireAuth, async (req, res) => {
  const { authCode } = req.body;
  const userId = (req as any).user.sub;

  if (!authCode?.trim()) return res.status(400).json({ error: 'Auth code is required' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'pending_admin_auth') return res.status(400).json({ error: 'Not waiting for admin auth' });
    if (user.adminAuthCode !== authCode.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid auth code' });
    }

    // Success: activate user, clear the code
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        adminAuthCode: null,
      },
    });

    const { accessToken, refreshToken } = issueFullJWT(
      updatedUser.id,
      updatedUser.tenantId!,
      'admin'
    );

    res.json({
      success: true,
      tenantName: user.tenant?.name,
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        status: updatedUser.status,
        tenantId: updatedUser.tenantId,
      },
      session: { access_token: accessToken, refresh_token: refreshToken },
    });
  } catch (error) {
    console.error('Verify admin auth error:', error);
    res.status(500).json({ error: 'Failed to verify auth code' });
  }
});

// ─── Admin: Invite Code Management ───────────────────────────────────────────

/** Generates a random uppercase alphanumeric code of given length */
function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/auth/admin/generate-invite
router.post('/admin/generate-invite', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;
  const userId = (req as any).user.sub;
  const { expiresInDays, customCode } = req.body; // optional — default 30 days

  try {
    let code: string;
    
    if (customCode && typeof customCode === 'string' && customCode.trim() !== '') {
      code = customCode.trim().toUpperCase();
      // Check if this custom code already exists globally (since codes might need to be globally unique for the join endpoint to work smoothly)
      const existing = await prisma.inviteCode.findUnique({ where: { code } });
      if (existing) {
        return res.status(400).json({ error: 'This invite code is already in use' });
      }
    } else {
      // Generate a unique code (retry if collision)
      let attempts = 0;
      do {
        code = generateInviteCode(8);
        const existing = await prisma.inviteCode.findUnique({ where: { code } });
        if (!existing) break;
        attempts++;
      } while (attempts < 5);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? 30));

    const invite = await prisma.inviteCode.create({
      data: {
        tenantId,
        code,
        createdById: userId,
        expiresAt,
      },
    });

    res.json({
      success: true,
      invite: {
        id: invite.id,
        code: invite.code,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
});

// GET /api/auth/admin/invite-codes
router.get('/admin/invite-codes', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;

  try {
    const codes = await prisma.inviteCode.findMany({
      where: { tenantId },
      include: {
        usedBy: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        isUsed: c.usedBy.length > 0,
        isExpired: c.expiresAt ? new Date() > c.expiresAt : false,
        usedBy: c.usedBy.map(u => ({ name: u.name, phone: u.phone })),
        createdBy: c.createdBy?.name ?? 'Admin',
      })),
    });
  } catch (error) {
    console.error('List invite codes error:', error);
    res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

// POST /api/auth/admin/invite-user
// Invites a user directly via phone number.
router.post('/admin/invite-user', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;
  const { phone } = req.body;

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const cleanPhone = phone.trim();

  try {
    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } });

    if (user) {
      if (user.tenantId && user.tenantId !== tenantId) {
        return res.status(400).json({ error: 'User is already part of another organisation' });
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tenantId, status: 'invited_to_org' },
      });
    } else {
      user = await prisma.user.create({
        data: { phone: cleanPhone, tenantId, status: 'invited_to_org' },
      });
    }

    res.json({ success: true, user: { id: user.id, phone: user.phone, status: user.status } });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});


// ─── Part B: Organisation Join ────────────────────────────────────────────────

// POST /api/auth/join-org
router.post('/join-org', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  const userId = (req as any).user.sub;

  if (!inviteCode?.trim()) return res.status(400).json({ error: 'Invite code is required' });

  try {
    // Validate invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode.trim().toUpperCase() },
      include: { tenant: true },
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invite code' });
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    // Update user: attach tenant, set status pending_approval, and associate with invite code
    const user = await prisma.user.update({
      where: { id: userId },
      data: { tenantId: invite.tenantId, status: 'pending_approval', inviteCodeId: invite.id },
    });

    // Notify admins in this tenant via Socket.io
    io.to(`admin:${invite.tenantId}`).emit('member:pending', {
      userId: user.id,
      name: user.name,
      phone: user.phone,
      tenantId: invite.tenantId,
    });

    // Issue new limited JWT reflecting updated status
    const accessToken = issueLimitedJWT(user.id, 'pending_approval');
    const refreshToken = issueLimitedJWT(user.id, 'pending_approval');

    res.json({
      success: true,
      tenantName: invite.tenant.name,
      user: { id: user.id, name: user.name, status: user.status },
      session: { access_token: accessToken, refresh_token: refreshToken },
    });
  } catch (error) {
    console.error('Join org error:', error);
    res.status(500).json({ error: 'Failed to join organisation' });
  }
});

// ─── Part C: Admin Approval ───────────────────────────────────────────────────

// GET /api/auth/admin/pending-members
router.get('/admin/pending-members', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;
  try {
    const members = await prisma.user.findMany({
      where: { tenantId, status: 'pending_approval' },
      select: { id: true, name: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ members });
  } catch (error) {
    console.error('Pending members error:', error);
    res.status(500).json({ error: 'Failed to fetch pending members' });
  }
});

// POST /api/auth/admin/approve
router.post('/admin/approve', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  const tenantId = (req as any).user.app_metadata?.tenant_id;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
    });

    // Auto-join public channels for this tenant
    const publicChannels = await prisma.channel.findMany({
      where: { tenantId, accessType: 'public' },
      select: { id: true },
    });

    if (publicChannels.length > 0) {
      await prisma.channelMember.createMany({
        data: publicChannels.map((ch) => ({
          tenantId,
          channelId: ch.id,
          userId,
          role: 'member',
        })),
        skipDuplicates: true,
      });
    }

    // Issue full JWT with tenant + role
    const { accessToken, refreshToken } = issueFullJWT(user.id, tenantId, user.role);

    // Push to user via Socket.io
    io.to(`user:${userId}`).emit('approval:granted', {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId },
    });

    res.json({ success: true, user: { id: user.id, name: user.name, status: 'active' } });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// POST /api/auth/admin/reject
router.post('/admin/reject', requireAuth, requireAdmin, async (req, res) => {
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'rejected', tenantId: null },
    });

    // Push rejection to user via Socket.io
    io.to(`user:${userId}`).emit('approval:rejected', {
      reason: reason || 'Your request was not approved.',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// ─── Part D: Channel Access ───────────────────────────────────────────────────

// POST /api/auth/channels/:channelId/request-join
router.post('/channels/:channelId/request-join', requireAuth, async (req, res) => {
  const { channelId } = req.params;
  const userId = (req as any).user.sub;
  const tenantId = (req as any).user.app_metadata?.tenant_id;

  try {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, tenantId },
    });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Notify channel admins
    io.to(`admin:${tenantId}`).emit('channel:join_request', { userId, channelId, channelName: channel.name });

    res.json({ success: true, message: 'Join request sent to channel admins' });
  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({ error: 'Failed to request channel access' });
  }
});

// ─── Part E: Member Channel Assignment ───────────────────────────────────────

// GET /api/auth/admin/tenant-structure
// Returns all hubs with their nested channels for this tenant.
router.get('/admin/tenant-structure', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;

  try {
    const hubs = await prisma.hub.findMany({
      where: { tenantId },
      include: {
        channels: {
          where: { tenantId },
          select: { id: true, name: true, category: true, accessType: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Also fetch channels that have NO hub (hubId is null)
    const ungroupedChannels = await prisma.channel.findMany({
      where: { tenantId, hubId: null },
      select: { id: true, name: true, category: true, accessType: true },
      orderBy: { name: 'asc' },
    });

    const result = [
      ...hubs.map((h) => ({
        id: h.id,
        name: h.name,
        channels: h.channels,
      })),
      ...(ungroupedChannels.length > 0
        ? [{ id: '__ungrouped__', name: 'General', channels: ungroupedChannels }]
        : []),
    ];

    res.json({ hubs: result });
  } catch (error) {
    console.error('Tenant structure error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant structure' });
  }
});

// GET /api/auth/admin/delta-sync
// Returns all hubs, all channels, and all channel_members for offline admin sync.
router.get('/admin/delta-sync', requireAuth, requireAdmin, async (req, res) => {
  const tenantId = (req as any).user.app_metadata?.tenant_id;

  try {
    const hubs = await prisma.hub.findMany({ where: { tenantId } });
    const channels = await prisma.channel.findMany({ where: { tenantId } });
    const channelMembers = await prisma.channelMember.findMany({
      where: { tenantId },
      select: {
        userId: true,
        channelId: true,
        role: true,
        joinedAt: true,
      }
    });

    res.json({ hubs, channels, channelMembers });
  } catch (error) {
    console.error('Admin delta sync error:', error);
    res.status(500).json({ error: 'Failed to perform delta sync' });
  }
});


// GET /api/auth/admin/member-channels/:userId
// Returns list of channel IDs the user is currently a member of.
router.get('/admin/member-channels/:userId', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const tenantId = (req as any).user.app_metadata?.tenant_id;

  try {
    const memberships = await prisma.channelMember.findMany({
      where: { userId, tenantId },
      select: { channelId: true },
    });
    res.json({ channelIds: memberships.map((m) => m.channelId) });
  } catch (error) {
    console.error('Member channels error:', error);
    res.status(500).json({ error: 'Failed to fetch member channels' });
  }
});

// POST /api/auth/admin/member-channels/:userId
// Full sync: adds missing memberships, removes unchecked ones.
router.post('/admin/member-channels/:userId', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const adminId = (req as any).user.sub;
  const tenantId = (req as any).user.app_metadata?.tenant_id;
  const { channelIds } = req.body as { channelIds: string[] };

  if (!Array.isArray(channelIds)) {
    return res.status(400).json({ error: 'channelIds must be an array' });
  }

  try {
    // 1. Get current user info to use their name in the system post
    const targetUser = await prisma.user.findUnique({
      where: { id: userId, tenantId },
      select: { name: true, phone: true }
    });
    const userName = targetUser?.name || targetUser?.phone || 'A user';

    // 2. Find existing memberships
    const existingMemberships = await prisma.channelMember.findMany({
      where: { userId, tenantId }
    });
    const existingChannelIds = existingMemberships.map(m => m.channelId);

    // 3. Identify removed and added
    const removedMemberships = existingMemberships.filter(m => !channelIds.includes(m.channelId));
    const addedChannelIds = channelIds.filter(id => !existingChannelIds.includes(id));

    await prisma.$transaction(async (tx) => {
      // ─── REMOVE ───
      if (removedMemberships.length > 0) {
        // Delete records
        await tx.channelMember.deleteMany({
          where: { id: { in: removedMemberships.map(m => m.id) } }
        });

        // Write WatermelonDB Tombstones so clients know to delete them locally
        await tx.deletedRecord.createMany({
          data: removedMemberships.map(m => ({
            recordId: m.id,
            tableName: 'channel_members',
            tenantId
          }))
        });

        // Write system posts in each channel
        await tx.post.createMany({
          data: removedMemberships.map(m => ({
            tenantId,
            authorId: adminId, // System post authored by the admin who did it
            channelId: m.channelId,
            content: `${userName} was removed from the channel.`,
            eventType: 'system'
          }))
        });
      }

      // ─── ADD ───
      if (addedChannelIds.length > 0) {
        await tx.channelMember.createMany({
          data: addedChannelIds.map(channelId => ({
            tenantId,
            channelId,
            userId,
            role: 'member'
          })),
          skipDuplicates: true
        });

        // Write system posts
        await tx.post.createMany({
          data: addedChannelIds.map(channelId => ({
            tenantId,
            authorId: adminId,
            channelId,
            content: `${userName} was added to the channel.`,
            eventType: 'system'
          }))
        });
      }
    });

    res.json({ success: true, channelIds });
  } catch (error) {
    console.error('Update member channels error:', error);
    res.status(500).json({ error: 'Failed to update channel memberships' });
  }
});

export default router;

