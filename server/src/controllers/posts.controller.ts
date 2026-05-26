import { Request, Response } from 'express';
import { prisma, io } from '../index';

export const getPosts = async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const { title, content, author } = req.body;
    if (!title || !content || !author) {
      res.status(400).json({ error: 'Missing title, content, or author' });
      return;
    }

    const post = await prisma.post.create({
      data: { title, content, author },
    });

    // Broadcast new post to socket clients
    io.emit('posts:new', post);

    res.status(201).json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
