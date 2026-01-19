import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import { join } from 'path';
import { existsSync } from 'fs';
import { initDatabase, db } from './db';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { boardRoutes } from './routes/board';
import { kinopoiskRoutes } from './routes/kinopoisk';
import { cleanupExpiredSessions } from './auth';

const PORT = 8080;

async function start() {
  // Инициализация БД
  initDatabase();
  
  // Очистка истекших сессий при старте
  cleanupExpiredSessions();
  
  // Периодическая очистка сессий (каждые 30 минут)
  setInterval(() => {
    cleanupExpiredSessions();
  }, 30 * 60 * 1000);
  
  const fastify = Fastify({
    logger: true
  });
  
  // Плагины
  await fastify.register(cookie);
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });
  
  // Роуты
  await fastify.register(authRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(boardRoutes);
  await fastify.register(kinopoiskRoutes);
  
  // Статические файлы (frontend build)
  const frontendDist = join(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    await fastify.register(staticFiles, {
      root: frontendDist,
      prefix: '/'
    });
    
    // Fallback для SPA
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        // Отдаём index.html для всех не-API роутов
        reply.sendFile('index.html', frontendDist);
      }
    });
  } else {
    fastify.log.warn(`Frontend dist not found at ${frontendDist}. Run 'npm run build' first.`);
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.code(503).send({ error: 'Frontend not built. Please run "npm run build" first.' });
      }
    });
  }
  
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
