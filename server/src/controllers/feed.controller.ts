import { Request, Response } from 'express';
import { prisma, io } from '../index';

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
      include: { author: true, equipmentGroup: true }
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const authorId = req.user?.id;
    const { content, equipmentGroupId, mediaUrls } = req.body;

    if (!tenantId || !authorId || !content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        tenantId,
        authorId,
        content,
        equipmentGroupId: equipmentGroupId || null,
        mediaUrls: mediaUrls || [],
      },
      include: { author: true, equipmentGroup: true }
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

    if (post.authorId !== authorId && role !== 'system_admin') {
      res.status(403).json({ error: 'Forbidden: Can only delete your own posts unless admin' });
      return;
    }

    await prisma.post.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { name, description, category, accessType } = req.body;

    if (!tenantId || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const group = await prisma.equipmentGroup.create({
      data: {
        tenantId,
        name,
        description: description || null,
        category: category || null,
        accessType: accessType || null,
      },
    });

    res.status(201).json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
