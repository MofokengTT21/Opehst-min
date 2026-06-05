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

    // ─── Channels (Strict Assignment Logic) ───────────────────────────────────
    // Admins see all channels.
    // Users see ONLY channels they are explicitly assigned to via ChannelMember.
    const channelFilter: any = isAdmin
      ? { tenantId }
      : { tenantId, members: { some: { userId } } };

    const [newChannels, updatedChannels] = await Promise.all([
      prisma.channel.findMany({ where: { ...channelFilter, createdAt: { gt: lastPulled } } }),
      prisma.channel.findMany({ where: { ...channelFilter, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } } }),
    ]);

    // ─── Channel Members (Access logic) ───────────────────────────────────────
    // Admins get all memberships (to manage them).
    // Users get ONLY their own memberships (so the UI knows their role and joined status).
    const memberFilter = isAdmin ? { tenantId } : { tenantId, userId };

    const [newChanMembers, updatedChanMembers] = await Promise.all([
      prisma.channelMember.findMany({ where: { ...memberFilter, joinedAt: { gt: lastPulled } } }),
      prisma.channelMember.findMany({ where: { ...memberFilter, updatedAt: { gt: lastPulled }, joinedAt: { lte: lastPulled } } }),
    ]);

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
      prisma.post.findMany({ 
        where: { tenantId, channelId: { in: postChannelIds }, createdAt: { gt: lastPulled } },
        take: 2000,
        orderBy: { createdAt: 'asc' }
      }),
      prisma.post.findMany({ 
        where: { tenantId, channelId: { in: postChannelIds }, updatedAt: { gt: lastPulled }, createdAt: { lte: lastPulled } },
        take: 2000,
        orderBy: { updatedAt: 'asc' }
      }),
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

    let nextTimestamp = nowMs;
    if (newPosts.length === 2000 || updatedPosts.length === 2000) {
      // Truncation occurred. Find the max timestamp among the returned posts.
      let maxTs = lastPulled.getTime();
      for (const p of [...newPosts, ...updatedPosts]) {
        const pt = new Date(p.updatedAt).getTime();
        if (pt > maxTs) maxTs = pt;
      }
      nextTimestamp = maxTs;
    }

    return res.json({ changes, timestamp: nextTimestamp });
  } catch (error: any) {
    console.error('[Sync] Pull error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/push
 * Handles offline writes from the client's WatermelonDB.
 */
router.post('/push', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { changes } = req.body;
  if (!changes) {
    return res.status(400).json({ error: 'Missing changes payload' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // For now, we only handle posts pushed from the client.
      // Other models (hubs, channels) are mutated via standard APIs (createChannel, etc) 
      // by admins while online. If admins need offline channel creation, add it here.
      if (changes.posts) {
        const { created, updated, deleted } = changes.posts;

        for (const post of created) {
          await tx.post.create({
            data: {
              id: post.id, // Keep the UUID generated by WatermelonDB!
              tenantId,
              authorId: userId, // enforce the current user is the author
              content: post.content,
              channelId: post.channel_id || null,
              subject: post.subject || null,
              eventType: post.event_type || null,
              mediaUrls: post.media_urls ? JSON.parse(post.media_urls) : [],
              createdAt: new Date(post.created_at),
              updatedAt: new Date(post.updated_at),
            }
          });
        }

        for (const post of updated) {
          await tx.post.update({
            where: { id: post.id },
            data: {
              content: post.content,
              subject: post.subject || null,
              mediaUrls: post.media_urls ? JSON.parse(post.media_urls) : [],
              updatedAt: new Date(post.updated_at),
            }
          });
        }

        for (const id of deleted) {
          // Verify ownership/admin before deleting if needed, or rely on Prisma where clause
          await tx.post.delete({ where: { id } }).catch(() => {});
          // We MUST create a tombstone for other clients!
          await tx.deletedRecord.create({
            data: { recordId: id, tableName: 'posts', tenantId }
          });
        }
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Sync] Push error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
