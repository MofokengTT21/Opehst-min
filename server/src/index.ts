import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import mainRouter from './routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', mainRouter);

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Opehst backend is running' });
});

// Socket.io Real-time connection handler
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // Auth onboarding rooms — join per-user room for approval push events
  socket.on('auth:join_room', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined room user:${userId}`);
  });

  // Admin room — join per-tenant room to receive pending-member notifications
  socket.on('auth:join_admin_room', (tenantId: string) => {
    socket.join(`admin:${tenantId}`);
    console.log(`Socket ${socket.id} joined room admin:${tenantId}`);
  });

  // Feed update event
  socket.on('posts:create', (post) => {
    console.log('Post created:', post);
    socket.broadcast.emit('posts:new', post);
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Opehst server running on port ${PORT}`);
  console.log(`⚡ Socket.io enabled & listening for events`);
  console.log(`========================================`);
});

export { io, prisma };
