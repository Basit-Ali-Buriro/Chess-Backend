// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (rooms[roomId].length >= 2) {
      socket.emit('roomFull');
      return;
    }

    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;

    const color = rooms[roomId].length === 1 ? 'white' : 'black';
    socket.emit('joinedRoom', { roomId, color });

    if (rooms[roomId].length === 2) {
      io.to(roomId).emit('startGame');
    }
  });

  socket.on('move', (moveData) => {
    socket.broadcast.to(socket.roomId).emit('opponentMove', moveData);
  });

  socket.on('gameOver', ({ roomId, winner, reason }) => {
    io.to(roomId).emit('gameOver', { winner, reason });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
    socket.broadcast.to(roomId).emit('opponentLeft');

    if (rooms[roomId].length === 0) {
      delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
