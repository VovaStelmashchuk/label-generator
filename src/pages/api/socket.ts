import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO } from 'socket.io';
import { verifyAuthToken } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: ServerIO;
    };
  };
};

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log('*First use, starting socket.io');

    const httpServer = res.socket.server;
    const io = new ServerIO(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      let userId: string | null = null;

      try {
        const cookieStr = socket.request.headers.cookie;
        if (cookieStr) {
          const cookies = Object.fromEntries(
            cookieStr.split('; ').map((v) => v.split(/=(.*)/s).map(decodeURIComponent))
          );
          const authToken = cookies['auth_token'];

          if (authToken) {
            const decoded = verifyAuthToken(authToken);
            if (decoded) {
              userId = decoded.userId;
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse auth token from socket handshake:", err);
      }

      if (userId) {
        socket.emit('message', {
          type: 'CONNECTION_SUCCESS',
          payload: `Connected to backend Socket.IO server as user: ${userId}`,
          userId: userId
        });
      } else {
        console.log('Unauthenticated connection attempt, disconnecting socket:', socket.id);
        socket.disconnect(true);
      }

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  } else {
    console.log('socket.io already running');
  }
  res.end();
}
