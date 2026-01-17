// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches Vercel preview pattern
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
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
