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

  // Feed update event
  socket.on('posts:create', (post) => {
    console.log('Post created:', post);
    // Broadcast to other clients
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
