import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// All sync routes require a valid JWT with a tenant_id.
router.use(requireAuth);

/**
 * GET /api/sync/pull?lastPulledAt=<epoch_ms>
 *
 * Returns only the records that changed SINCE the client's last pull.
 * Response shape is the exact WatermelonDB SyncPullResult contract:
 * {
 *   changes: {
 *     <table>: { created: [], updated: [], deleted: [] }
 *   },
 *   timestamp: <epoch_ms>   ← client stores this and sends it next time
 * }
 *
 * Security: every query is hard-scoped to req.user.tenant_id, so a user
 * from Tenant A can never receive Tenant B's data even if they forge a
 * `lastPulledAt` value.
 */
router.get('/pull', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId   = req.user?.id;
  const isAdmin  = req.user?.role === 'admin';

  if (!tenantId || !userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse lastPulledAt — 0 means first-ever sync (full pull).
  const rawTs      = req.query.lastPulledAt;
  const lastPulled = rawTs ? new Date(Number(rawTs)) : new Date(0);
  const now        = new Date();
  const nowMs      = now.getTime();

  try {
    // ─── Hubs (admin only) ────────────────────────────────────────────────────
    const [newHubs, updatedHubs] = isAdmin
      ? await Promise.all([
          prisma.hub.findMany({ where: { tenantId, createdAt: { gt: lastPulled } } }),
          prisma.hub.findMany({ where: { tenantId, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } } }),
        ])
      : [[], []];

    // ─── Channels (all members — scoped to channels the user belongs to) ──────
    const channelFilter = isAdmin
      ? { tenantId }
      : { tenantId, members: { some: { userId } } };

    const [newChannels, updatedChannels] = await Promise.all([
      prisma.channel.findMany({ where: { ...channelFilter, createdAt: { gt: lastPulled } } }),
      prisma.channel.findMany({ where: { ...channelFilter, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } } }),
    ]);

    // ─── Channel Members (admin only) ─────────────────────────────────────────
    const [newChanMembers, updatedChanMembers] = isAdmin
      ? await Promise.all([
          prisma.channelMember.findMany({ where: { tenantId, joinedAt: { gt: lastPulled } } }),
          prisma.channelMember.findMany({ where: { tenantId, updatedAt: { gt: lastPulled }, joinedAt: { lte: lastPulled } } }),
        ])
      : [[], []];

    // ─── Users (all members — admin sees all, users see only active peers) ────
    const userFilter = isAdmin
      ? { tenantId }
      : { tenantId, status: 'active' };

    const [newUsers, updatedUsers] = await Promise.all([
      prisma.user.findMany({ where: { ...userFilter, createdAt: { gt: lastPulled } } }),
      prisma.user.findMany({ where: { ...userFilter, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } } }),
    ]);

    // ─── Posts (only in channels the user belongs to) ─────────────────────────
    const postChannelIds = (await prisma.channelMember.findMany({
      where: { tenantId, userId },
      select: { channelId: true },
    })).map(m => m.channelId);

    const [newPosts, updatedPosts] = await Promise.all([
      prisma.post.findMany({ where: { tenantId, channelId: { in: postChannelIds }, createdAt: { gt: lastPulled } } }),
      prisma.post.findMany({ where: { tenantId, channelId: { in: postChannelIds }, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } } }),
    ]);

    // ─── Tombstones — deleted records since last pull ─────────────────────────
    const tombstones = await prisma.deletedRecord.findMany({
      where: { tenantId, deletedAt: { gt: lastPulled } },
      select: { recordId: true, tableName: true },
    });

    // Group tombstones by table
    const deletedByTable: Record<string, string[]> = {};
    for (const t of tombstones) {
      if (!deletedByTable[t.tableName]) deletedByTable[t.tableName] = [];
      deletedByTable[t.tableName].push(t.recordId);
    }
    const deletedFor = (table: string) => deletedByTable[table] ?? [];

    // ─── Format helpers ───────────────────────────────────────────────────────
    const fmtHub = (h: any) => ({
      id: h.id, tenant_id: h.tenantId, name: h.name,
      description: h.description ?? '',
      created_at: new Date(h.createdAt).getTime(),
      updated_at: new Date(h.updatedAt).getTime(),
    });

    const fmtChannel = (g: any) => ({
      id: g.id, tenant_id: g.tenantId, hub_id: g.hubId ?? '',
      name: g.name, description: g.description ?? '',
      category: g.category ?? '', access_type: g.accessType ?? '',
      event_types: g.eventTypes ? JSON.stringify(g.eventTypes) : '[]',
      created_at: new Date(g.createdAt).getTime(),
      updated_at: new Date(g.updatedAt).getTime(),
    });

    const fmtChannelMember = (m: any) => ({
      // WatermelonDB ID is the compound key used everywhere in the app
      id: `${m.userId}_${m.channelId}`,
      tenant_id: m.tenantId, channel_id: m.channelId,
      user_id: m.userId, role: m.role,
      joined_at: new Date(m.joinedAt).getTime(),
      created_at: new Date(m.joinedAt).getTime(),
      updated_at: new Date(m.updatedAt).getTime(),
    });

    const fmtUser = (u: any) => ({
      id: u.id, tenant_id: u.tenantId ?? '',
      role: u.role, name: u.name ?? '',
      phone: u.phone, email: u.email ?? '',
      status: u.status, avatar_url: u.avatarUrl ?? '',
      created_at: new Date(u.createdAt).getTime(),
      updated_at: new Date(u.updatedAt).getTime(),
    });

    const fmtPost = (p: any) => ({
      id: p.id, tenant_id: p.tenantId, author_id: p.authorId,
      channel_id: p.channelId ?? '', subject: p.subject ?? '',
      content: p.content, event_type: p.eventType ?? '',
      media_urls: p.mediaUrls ? JSON.stringify(p.mediaUrls) : '[]',
      is_pinned: p.isPinned,
      created_at: new Date(p.createdAt).getTime(),
      updated_at: new Date(p.updatedAt).getTime(),
    });

    // ─── Build WatermelonDB SyncPullResult ────────────────────────────────────
    const changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {
      hubs: {
        created: newHubs.map(fmtHub),
        updated: updatedHubs.map(fmtHub),
        deleted: deletedFor('hubs'),
      },
      channels: {
        created: newChannels.map(fmtChannel),
        updated: updatedChannels.map(fmtChannel),
        deleted: deletedFor('channels'),
      },
      channel_members: {
        created: newChanMembers.map(fmtChannelMember),
        updated: updatedChanMembers.map(fmtChannelMember),
        deleted: deletedFor('channel_members'),
      },
      users: {
        created: newUsers.map(fmtUser),
        updated: updatedUsers.map(fmtUser),
        deleted: deletedFor('users'),
      },
      posts: {
        created: newPosts.map(fmtPost),
        updated: updatedPosts.map(fmtPost),
        deleted: deletedFor('posts'),
      },
    };

    return res.json({ changes, timestamp: nowMs });
  } catch (error: any) {
    console.error('[Sync] Pull error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
