import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';
import { whatsappService } from './services/whatsappService';

const PORT = Number(process.env.PORT ?? 3000);

function validateEnv() {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (process.env.JWT_SECRET === 'change-this-secret') {
    console.error('JWT_SECRET es el valor por defecto inseguro. Generá uno robusto con: openssl rand -base64 32');
    process.exit(1);
  }

  if (process.env.REFRESH_TOKEN_SECRET === 'change-this-refresh-secret') {
    console.error('REFRESH_TOKEN_SECRET es el valor por defecto inseguro. Generá uno robusto con: openssl rand -base64 32');
    process.exit(1);
  }
}

import { Server as SocketIOServer } from 'socket.io';

async function main() {
  validateEnv();
  await connectDB();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          callback(null, origin);
        } else {
          callback(new Error('No permitido por CORS'), false);
        }
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      credentials: true
    }
  });

  app.set('io', io);

  whatsappService.on('qr', (qr) => {
    io.emit('whatsapp_qr', qr);
  });

  whatsappService.on('ready', () => {
    io.emit('whatsapp_ready');
  });

  whatsappService.on('disconnected', () => {
    io.emit('whatsapp_disconnected');
  });

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nEl puerto ${PORT} ya está en uso.`);
      console.error(`   Probá con otro puerto:`);
      console.error(`   PORT=3001 npm run dev    (o editá server/.env)`);
      process.exit(1);
    }
    console.error('Error del servidor:', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
