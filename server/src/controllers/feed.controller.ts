import { Request, Response } from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const createPostSchema = z.object({
  content: z.string().trim().min(1, 'Post content cannot be empty').max(5000, 'Post content is too long'),
  channelId: z.string().optional().nullable(),
  subject: z.string().trim().max(100, 'Subject is too long').optional().nullable(),
  eventType: z.string().max(50).optional().nullable(),
  mediaUrls: z.array(z.string().url('Invalid media URL')).max(10, 'Too many media attachments').optional().default([]),
});

export const getPosts = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant' });
      return;
    }

    const posts = await prisma.post.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { author: true, channel: true }
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getHubs = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID required' });
      return;
    }

    const hubs = await prisma.hub.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(hubs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createHub = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID required' });
      return;
    }

    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const hub = await prisma.hub.create({
      data: {
        tenantId,
        name,
        description,
      }
    });

    res.status(201).json(hub);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getChannels = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant' });
      return;
    }

    const channels = await prisma.channel.findMany({
      where: { 
        tenantId,
        members: {
          some: { userId: req.user?.id }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(channels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMembers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant' });
      return;
    }

    const members = await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        role: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const author_id = req.user?.id;

    if (!tenant_id || !author_id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { content, channelId, mediaUrls, subject, eventType } = parsed.data;

    const post = await prisma.post.create({
      data: {
        tenantId: tenant_id,
        authorId: author_id,
        content,
        channelId: channelId || null,
        subject: subject || null,
        eventType: eventType || null,
        mediaUrls: mediaUrls || [],
      },
      include: { author: true, channel: true }
    });

    io.emit('posts:new', post);

    res.status(201).json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const pinPost = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const role = req.user?.role;
    const { id } = req.params;

    // Supabase sets role to 'admin' or 'user' typically in our custom metadata.
    if (!tenantId || role !== 'system_admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required to pin' });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.tenantId !== tenantId) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { isPinned: !post.isPinned }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const role = req.user?.role;
    const authorId = req.user?.id;
    const { id } = req.params;

    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.tenantId !== tenantId) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.authorId !== authorId && role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Can only delete your own posts unless admin' });
      return;
    }

    // Delete the post and write a tombstone in one transaction so the sync
    // engine can deliver the deletion to all clients on their next pull.
    await prisma.$transaction([
      prisma.post.delete({ where: { id } }),
      prisma.deletedRecord.create({
        data: { recordId: id, tableName: 'posts', tenantId },
      }),
    ]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createChannel = async (req: Request, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { name, description, category, accessType, eventTypes = [] } = req.body;

    if (!tenant_id || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const channel = await prisma.channel.create({
      data: {
        tenantId: tenant_id,
        name,
        description: description || null,
        category: category || null,
        accessType: accessType || null,
        eventTypes: eventTypes || [],
        members: {
          create: {
            userId: req.user?.id as string,
            tenantId: tenant_id,
            role: 'admin',
          }
        }
      },
    });

    res.status(201).json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const authorId = req.user?.id;
    const { postId } = req.params;
    const { content, mediaUrls = [] } = req.body;

    if (!tenantId || !authorId || !content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        tenantId,
        postId,
        authorId,
        content,
        mediaUrls
      },
      include: { author: true }
    });

    res.status(201).json(comment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createReaction = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;
    const { postId } = req.params;
    const { type } = req.body;

    if (!tenantId || !userId || !type) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Upsert logic (one reaction per user per post) could be added here,
    // but for now we simply create a new reaction record.
    const reaction = await prisma.reaction.create({
      data: {
        tenantId,
        postId,
        userId,
        type
      }
    });

    res.status(201).json(reaction);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
