import * as SecureStore from 'expo-secure-store';
import { database } from '../database';
import Post from '../database/models/Post';
import Channel from '../database/models/Channel';

const API_URL = 'http://192.168.1.102:3000/api/feed';
const TOKEN_KEY = 'opehst_access_token';

const getHeaders = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchPosts = async () => {
  try {
    const response = await fetch(`${API_URL}/posts`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }

    const posts = await response.json();

    await database.write(async () => {
      const postsCollection = database.collections.get<Post>('posts');
      const existing = await postsCollection.query().fetch();

      for (const p of posts) {
        const existingPost = existing.find(e => e.id === p.id);
        
        if (existingPost) {
          await existingPost.update(record => {
            record.content = p.content;
            record.isPinned = p.isPinned;
            record.mediaUrls = p.mediaUrls;
          });
        } else {
          await postsCollection.create(record => {
            record._raw.id = p.id; // Override UUID from Watermelon to match Prisma UUID
            record.tenantId = p.tenantId;
            record.authorId = p.authorId;
            if (p.channelId) {
              record.channelId = p.channelId;
            }
            record.content = p.content;
            record.subject = p.subject;
            record.eventType = p.eventType;
            record.isPinned = p.isPinned;
            record.mediaUrls = p.mediaUrls;
            record.createdAt = new Date(p.createdAt).getTime();
            record.updatedAt = new Date(p.updatedAt).getTime();
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Fetch posts error:', error);
    return false;
  }
};

export const createPost = async (content: string, channelId?: string, mediaUrls: string[] = [], subject?: string, eventType?: string) => {
  try {
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ content, channelId, mediaUrls, subject, eventType }),
    });

    if (!response.ok) {
      throw new Error('Failed to create post');
    }

    const p = await response.json();

    await database.write(async () => {
      await database.collections.get<Post>('posts').create(record => {
        record._raw.id = p.id;
        record.tenantId = p.tenantId;
        record.authorId = p.authorId;
        record.channelId = p.channelId;
        record.content = p.content;
        record.subject = p.subject;
        record.eventType = p.eventType;
        record.isPinned = p.isPinned;
        record.mediaUrls = p.mediaUrls;
        record.createdAt = new Date(p.createdAt).getTime();
        record.updatedAt = new Date(p.updatedAt).getTime();
      });
    });

    return true;
  } catch (error) {
    console.error('Create post error:', error);
    return false;
  }
};

import { ChannelEventType } from '@opehst/shared';

export const createChannel = async (name: string, description?: string, category?: string, accessType?: string, eventTypes: ChannelEventType[] = []) => {
  try {
    const response = await fetch(`${API_URL}/channels`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, description, category, accessType, eventTypes }),
    });

    if (!response.ok) {
      throw new Error('Failed to create group');
    }

    const g = await response.json();

    await database.write(async () => {
      await database.collections.get<Channel>('channels').create(record => {
        record._raw.id = g.id;
        record.tenantId = g.tenantId;
        record.name = g.name;
        record.description = g.description;
        record.category = g.category;
        record.accessType = g.accessType;
        record.eventTypes = g.eventTypes || [];
        record.createdAt = new Date(g.createdAt).getTime();
        record.updatedAt = new Date(g.updatedAt).getTime();
      });
    });

    return true;
  } catch (error) {
    console.error('Create channel error:', error);
    return false;
  }
};
