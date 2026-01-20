import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import multipart from '@fastify/multipart';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
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
    logger: true,
    bodyLimit: 500 * 1024 * 1024, // 500MB для больших видео файлов
    requestTimeout: 600000 // 10 минут для загрузки больших файлов
  });
  
  // Плагины
  await fastify.register(cookie);
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });
  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024 // 500MB максимум для видео
    }
  });

  // Создаем директорию для видео, если её нет
  const videosDir = join(process.cwd(), 'data', 'videos');
  if (!existsSync(videosDir)) {
    mkdirSync(videosDir, { recursive: true });
  }

  // Роуты
  await fastify.register(authRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(boardRoutes);
  await fastify.register(kinopoiskRoutes);
  
  // Статические файлы для видео (после роутов, чтобы не перехватывать API запросы)
  await fastify.register(staticFiles, {
    root: videosDir,
    prefix: '/api/videos/',
    decorateReply: false,
    setHeaders: (res, pathName) => {
      // Устанавливаем правильные MIME-типы для видео
      const ext = pathName.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska'
      };
      if (ext && mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      // Разрешаем CORS для видео
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    }
  });
  
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
