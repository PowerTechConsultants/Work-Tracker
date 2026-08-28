import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import db from '../db';
import { verifyAccessToken } from './jwt';
import { isTokenRevoked } from './blacklist';
import { config } from './config';

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      if (isTokenRevoked(payload.sub, payload.iat)) return next(new Error('Token revoked'));
      const user = db.prepare('SELECT status FROM users WHERE id = ?').get(payload.sub) as any;
      if (!user || user.status !== 'active') return next(new Error('Account is inactive'));
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`[Socket] User ${user.sub} connected`);
    socket.join(`user:${user.sub}`);

    socket.on('join-user', (userId: string) => {
      if (userId === user.sub) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('join-team', (teamName: string) => {
      const membership = db.prepare('SELECT 1 FROM team_members WHERE team_name = ? AND user_id = ?').get(teamName, user.sub);
      if (membership) {
        socket.join(`team:${teamName}`);
      }
    });

    socket.on('leave-team', (teamName: string) => {
      socket.leave(`team:${teamName}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${user.sub} disconnected`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function closeSocket(): void {
  if (io) {
    io.close();
    io = null;
  }
}
