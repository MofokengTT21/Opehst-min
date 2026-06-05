import * as SecureStore from 'expo-secure-store';
import { database } from '../database';
import Post from '../database/models/Post';
import Channel from '../database/models/Channel';
import Hub from '../database/models/Hub';
import User from '../database/models/User';

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
      const usersCollection = database.collections.get<User>('users');
      const existing = await postsCollection.query().fetch();

      for (const p of posts) {
        if (p.author) {
          try {
            await usersCollection.find(p.author.id);
          } catch {
            await usersCollection.create(record => {
              record._raw.id = p.author.id;
              record.tenantId = p.author.tenantId;
              record.role = p.author.role;
              record.name = p.author.name;
              record.phone = p.author.phone;
              record.email = p.author.email;
              record.status = p.author.status;
              record.avatarUrl = p.author.avatarUrl;
              record.createdAt = new Date(p.author.createdAt || Date.now()).getTime();
              record.updatedAt = new Date(p.author.updatedAt || Date.now()).getTime();
            });
          }
        }

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

export const fetchMembers = async () => {
  try {
    const response = await fetch(`${API_URL}/members`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch members');
    }

    const members = await response.json();

    await database.write(async () => {
      const usersCollection = database.collections.get<User>('users');
      const existing = await usersCollection.query().fetch();

      for (const m of members) {
        const existingMember = existing.find(e => e.id === m.id);
        
        if (existingMember) {
          await existingMember.update(record => {
            record.role = m.role;
            record.name = m.name;
            record.phone = m.phone;
            record.email = m.email;
            record.status = m.status;
            record.avatarUrl = m.avatarUrl;
          });
        } else {
          await usersCollection.create(record => {
            record._raw.id = m.id;
            record.tenantId = m.tenantId;
            record.role = m.role;
            record.name = m.name;
            record.phone = m.phone;
            record.email = m.email;
            record.status = m.status;
            record.avatarUrl = m.avatarUrl;
            record.createdAt = new Date(m.createdAt || Date.now()).getTime();
            record.updatedAt = new Date(m.updatedAt || Date.now()).getTime();
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Fetch members error:', error);
    return false;
  }
};

export const fetchHubs = async () => {
  try {
    const response = await fetch(`${API_URL}/hubs`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch hubs');
    }

    const hubs = await response.json();

    await database.write(async () => {
      const hubsCollection = database.collections.get<Hub>('hubs');
      const existing = await hubsCollection.query().fetch();

      for (const h of hubs) {
        const existingHub = existing.find(e => e.id === h.id);
        
        if (existingHub) {
          await existingHub.update(record => {
            record.name = h.name;
            record.description = h.description;
          });
        } else {
          await hubsCollection.create(record => {
            record._raw.id = h.id;
            record.tenantId = h.tenantId;
            record.name = h.name;
            record.description = h.description;
            record.createdAt = new Date(h.createdAt).getTime();
            record.updatedAt = new Date(h.updatedAt).getTime();
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Fetch hubs error:', error);
    return false;
  }
};

export const createHubApi = async (name: string, description?: string) => {
  try {
    const response = await fetch(`${API_URL}/hubs`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      throw new Error('Failed to create hub');
    }

    const h = await response.json();

    await database.write(async () => {
      const hubsCollection = database.collections.get<Hub>('hubs');
      await hubsCollection.create(record => {
        record._raw.id = h.id;
        record.tenantId = h.tenantId;
        record.name = h.name;
        record.description = h.description;
        record.createdAt = new Date(h.createdAt).getTime();
        record.updatedAt = new Date(h.updatedAt).getTime();
      });
    });

    return h;
  } catch (error) {
    console.error('Create hub error:', error);
    throw error;
  }
};

export const fetchChannels = async () => {
  try {
    const response = await fetch(`${API_URL}/channels`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch channels');
    }

    const channels = await response.json();

    await database.write(async () => {
      const channelsCollection = database.collections.get<Channel>('channels');
      const existing = await channelsCollection.query().fetch();

      for (const g of channels) {
        const existingChannel = existing.find(e => e.id === g.id);
        
        if (existingChannel) {
          await existingChannel.update(record => {
            record.name = g.name;
            record.description = g.description;
            record.category = g.category;
            record.accessType = g.accessType;
            record.eventTypes = g.eventTypes || [];
            if (g.hubId) record.hubId = g.hubId;
          });
        } else {
          await channelsCollection.create(record => {
            record._raw.id = g.id;
            record.tenantId = g.tenantId;
            if (g.hubId) record.hubId = g.hubId;
            record.name = g.name;
            record.description = g.description;
            record.category = g.category;
            record.accessType = g.accessType;
            record.eventTypes = g.eventTypes || [];
            record.createdAt = new Date(g.createdAt).getTime();
            record.updatedAt = new Date(g.updatedAt).getTime();
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Fetch channels error:', error);
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
      const postsCollection = database.collections.get<Post>('posts');
      try {
        await postsCollection.find(p.id);
        // Post already inserted by socket
      } catch {
        await postsCollection.create(record => {
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
      }
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



