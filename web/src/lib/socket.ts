import { io, Socket } from 'socket.io-client';
import { getAccessToken, doRefresh } from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;
let socketUrl: string | null = null;

const isJwtExpired = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const initializeSocket = (token: string) => {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000');

  if (socket && (currentToken !== token || socketUrl !== API_URL)) {
    socket.close();
    socket = null;
  }

  if (!socket) {
    currentToken = token;
    socketUrl = API_URL;
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    socket.on('connect', () => {
    });

    socket.on('disconnect', () => {
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    socket.on('reconnect_attempt', () => {
      const fresh = getAccessToken();
      if (!fresh || fresh !== currentToken) {
        socket?.close();
        return;
      }
      if (isJwtExpired(fresh)) {
        doRefresh()
          .then((newToken) => {
            if (socket && newToken !== currentToken) {
              currentToken = newToken;
              socket.auth = { token: newToken };
            }
          })
          .catch(() => {
            socket?.close();
          });
      }
    });
  }

  return socket;
};

export const getSocket = () => {
  if (!socket) throw new Error('Socket not initialized');
  return socket;
};

export const getSocketSafe = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
    currentToken = null;
  }
};

export { socket };

export const joinUserRoom = (userId: string) => {
  const tryJoin = () => {
    const s = getSocketSafe();
    if (s?.connected) { s.emit('join-user', userId); return true; }
    return false;
  };
  if (tryJoin()) return;
  const timer = setInterval(() => { if (tryJoin() && timer) clearInterval(timer); }, 500);
  setTimeout(() => { clearInterval(timer); }, 10000);
};

export const joinTeamRoom = (teamName: string) => {
  const s = getSocketSafe();
  if (s?.connected) s.emit('join-team', teamName);
};

export const leaveTeamRoom = (teamName: string) => {
  const s = getSocketSafe();
  if (s?.connected) s.emit('leave-team', teamName);
};

export function listenOnSocket(events: Record<string, (...args: any[]) => void>): () => void {
  let attached: Socket | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const attach = () => {
    const s = getSocketSafe();
    if (!s) return false;
    attached = s;
    for (const [event, handler] of Object.entries(events)) {
      s.on(event, handler as any);
    }
    return true;
  };

  if (!attach()) {
    timer = setInterval(() => {
      if (attach() && timer) clearInterval(timer);
    }, 400);
    setTimeout(() => { if (timer) clearInterval(timer); }, 15000);
  }

  return () => {
    if (timer) clearInterval(timer);
    if (attached) {
      for (const [event, handler] of Object.entries(events)) {
        attached.off(event, handler as any);
      }
    }
  };
}
