import io, { Socket } from 'socket.io-client';
import { database } from '../database';
import Post from '../database/models/Post';
import User from '../database/models/User';

const SOCKET_URL = 'http://192.168.1.102:3000';
let socket: Socket | null = null;

export const initSocket = () => {
  if (socket) return;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
  });

  // Listen for real-time posts
  socket.on('posts:new', async (p: any) => {
    try {
      console.log('[Socket] Received new post broadcast:', p.id);
      
      await database.write(async () => {
        const postsCollection = database.collections.get<Post>('posts');
        const usersCollection = database.collections.get<User>('users');
        
        // Ensure we don't insert a duplicate
        // If this device sent the post, the API response already wrote it locally.
        const existing = await postsCollection.query().fetch();
        const exists = existing.find(e => e.id === p.id);
        
        if (!exists) {
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

          await postsCollection.create(record => {
            record._raw.id = p.id;
            record.tenantId = p.tenantId;
            record.authorId = p.authorId;
            if (p.channelId) record.channelId = p.channelId;
            record.content = p.content;
            record.subject = p.subject;
            record.eventType = p.eventType;
            record.isPinned = p.isPinned;
            record.mediaUrls = p.mediaUrls || [];
            record.createdAt = new Date(p.createdAt).getTime();
            record.updatedAt = new Date(p.updatedAt).getTime();
          });
          console.log('[Socket] Successfully injected new post into local DB');
        } else {
          console.log('[Socket] Post already exists locally (duplicate avoided)');
        }
      });
    } catch (error) {
      console.error('[Socket] Failed to write new post to local DB:', error);
    }
  });
};

export const stopSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/** Returns the active socket instance, initialising it if needed */
export const getSocket = (): Socket => {
  if (!socket) initSocket();
  return socket!;
};

