import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { requireAuth } from '../auth';
import { Film, Showtime, Hall, Premier } from '../types';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, createWriteStream } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';

export async function adminRoutes(fastify: FastifyInstance) {
  // Требуем авторизацию для всех админских роутов
  fastify.addHook('onRequest', async (request, reply) => {
    await requireAuth(request, reply);
  });
  
  // ===== FILMS =====
  
  fastify.get('/api/admin/films', async () => {
    const films = db.prepare('SELECT * FROM films ORDER BY id DESC').all() as Film[];
    return { films: films.map(f => ({ 
      ...f, 
      isActive: Boolean(f.isActive),
      kinopoiskId: f.kinopoiskId || null
    })) };
  });
  
  fastify.post('/api/admin/films', async (request, reply) => {
    const data = request.body as Partial<Film>;
    
    if (!data.title || !data.durationMin || !data.ageRating) {
      return reply.code(400).send({ error: 'Title, durationMin, and ageRating are required' });
    }
    
    // Проверяем, нет ли уже фильма с таким kinopoiskId
    if (data.kinopoiskId) {
      const existing = db.prepare('SELECT id, title FROM films WHERE kinopoiskId = ?')
        .get(data.kinopoiskId) as { id: number; title: string } | undefined;
      
      if (existing) {
        return reply.code(409).send({ 
          error: 'Film already exists',
          message: `Фильм "${existing.title}" с ID Кинопоиска ${data.kinopoiskId} уже добавлен в базу (ID: ${existing.id})`
        });
      }
    }
    
    const result = db.prepare(`
      INSERT INTO films (title, durationMin, ageRating, format, description, posterUrl, isActive, kinopoiskId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.durationMin,
      data.ageRating,
      data.format || null,
      data.description || null,
      data.posterUrl || null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      data.kinopoiskId || null
    );
    
    const film = db.prepare('SELECT * FROM films WHERE id = ?').get(result.lastInsertRowid) as Film;
    return { film: { ...film, isActive: Boolean(film.isActive) } };
  });
  
  fastify.put('/api/admin/films/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<Film>;
    
    const existing = db.prepare('SELECT * FROM films WHERE id = ?').get(Number(id)) as Film | undefined;
    if (!existing) {
      return reply.code(404).send({ error: 'Film not found' });
    }
    
    // Проверяем, нет ли другого фильма с таким kinopoiskId (если kinopoiskId изменяется)
    if (data.kinopoiskId !== undefined && data.kinopoiskId !== existing.kinopoiskId) {
      const duplicate = db.prepare('SELECT id, title FROM films WHERE kinopoiskId = ? AND id != ?')
        .get(data.kinopoiskId, Number(id)) as { id: number; title: string } | undefined;
      
      if (duplicate) {
        return reply.code(409).send({ 
          error: 'Film already exists',
          message: `Фильм "${duplicate.title}" с ID Кинопоиска ${data.kinopoiskId} уже добавлен в базу (ID: ${duplicate.id})`
        });
      }
    }
    
    db.prepare(`
      UPDATE films 
      SET title = ?, durationMin = ?, ageRating = ?, format = ?, 
          description = ?, posterUrl = ?, isActive = ?, kinopoiskId = ?
      WHERE id = ?
    `).run(
      data.title ?? existing.title,
      data.durationMin ?? existing.durationMin,
      data.ageRating ?? existing.ageRating,
      data.format ?? existing.format,
      data.description ?? existing.description,
      data.posterUrl ?? existing.posterUrl,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.isActive,
      data.kinopoiskId !== undefined ? data.kinopoiskId : existing.kinopoiskId,
      Number(id)
    );
    
    const film = db.prepare('SELECT * FROM films WHERE id = ?').get(Number(id)) as Film;
    return { film: { ...film, isActive: Boolean(film.isActive) } };
  });
  
  fastify.delete('/api/admin/films/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = db.prepare('SELECT * FROM films WHERE id = ?').get(Number(id)) as Film | undefined;
    if (!existing) {
      return reply.code(404).send({ error: 'Film not found' });
    }
    
    db.prepare('DELETE FROM films WHERE id = ?').run(Number(id));
    return { success: true };
  });
  
  // ===== SHOWTIMES =====
  
  fastify.get('/api/admin/showtimes', async (request) => {
    const { date, hallId, startDate, endDate } = request.query as { 
      date?: string; 
      hallId?: string;
      startDate?: string;
      endDate?: string;
    };
    
    let query = 'SELECT s.*, f.title as filmTitle, f.durationMin as filmDuration FROM showtimes s';
    query += ' JOIN films f ON s.filmId = f.id';
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Поддержка диапазона дат для оптимизации загрузки недели
    if (startDate && endDate) {
      conditions.push("DATE(s.startAt) >= ? AND DATE(s.startAt) <= ?");
      params.push(startDate, endDate);
    } else if (date) {
      conditions.push("DATE(s.startAt) = ?");
      params.push(date);
    }
    
    if (hallId) {
      conditions.push('s.hallId = ?');
      params.push(Number(hallId));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.startAt';
    
    const showtimes = db.prepare(query).all(...params) as any[];
    return { showtimes: showtimes.map(s => ({
      ...s,
      isHidden: Boolean(s.isHidden)
    })) };
  });
  
  fastify.post('/api/admin/showtimes', async (request, reply) => {
    const data = request.body as Partial<Showtime>;
    
    if (!data.hallId || !data.filmId || !data.startAt) {
      return reply.code(400).send({ error: 'hallId, filmId, and startAt are required' });
    }
    
    // Получаем длительность фильма
    const film = db.prepare('SELECT durationMin FROM films WHERE id = ?')
      .get(data.filmId) as { durationMin: number } | undefined;
    
    if (!film) {
      return reply.code(400).send({ error: 'Film not found' });
    }
    
    // Вычисляем endAt
    const startDate = new Date(data.startAt);
    const endDate = new Date(startDate.getTime() + film.durationMin * 60 * 1000);
    const endAt = endDate.toISOString();
    
    const result = db.prepare(`
      INSERT INTO showtimes (hallId, filmId, startAt, endAt, priceFrom, note, isHidden)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.hallId,
      data.filmId,
      data.startAt,
      endAt,
      data.priceFrom || null,
      data.note || null,
      data.isHidden !== undefined ? (data.isHidden ? 1 : 0) : 0
    );
    
    const showtime = db.prepare('SELECT * FROM showtimes WHERE id = ?')
      .get(result.lastInsertRowid) as Showtime;
    
    return { showtime: { ...showtime, isHidden: Boolean(showtime.isHidden) } };
  });
  
  fastify.put('/api/admin/showtimes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<Showtime>;
    
    const existing = db.prepare('SELECT * FROM showtimes WHERE id = ?')
      .get(Number(id)) as Showtime | undefined;
    
    if (!existing) {
      return reply.code(404).send({ error: 'Showtime not found' });
    }
    
    const hallId = data.hallId ?? existing.hallId;
    const filmId = data.filmId ?? existing.filmId;
    const startAt = data.startAt ?? existing.startAt;
    
    // Получаем длительность фильма
    const film = db.prepare('SELECT durationMin FROM films WHERE id = ?')
      .get(filmId) as { durationMin: number } | undefined;
    
    if (!film) {
      return reply.code(400).send({ error: 'Film not found' });
    }
    
    // Вычисляем endAt
    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + film.durationMin * 60 * 1000);
    const endAt = endDate.toISOString();
    
    db.prepare(`
      UPDATE showtimes 
      SET hallId = ?, filmId = ?, startAt = ?, endAt = ?, 
          priceFrom = ?, note = ?, isHidden = ?
      WHERE id = ?
    `).run(
      hallId,
      filmId,
      startAt,
      endAt,
      data.priceFrom !== undefined ? data.priceFrom : existing.priceFrom,
      data.note !== undefined ? data.note : existing.note,
      data.isHidden !== undefined ? (data.isHidden ? 1 : 0) : existing.isHidden,
      Number(id)
    );
    
    const showtime = db.prepare('SELECT * FROM showtimes WHERE id = ?')
      .get(Number(id)) as Showtime;
    
    return { showtime: { ...showtime, isHidden: Boolean(showtime.isHidden) } };
  });
  
  fastify.delete('/api/admin/showtimes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = db.prepare('SELECT * FROM showtimes WHERE id = ?')
      .get(Number(id)) as Showtime | undefined;
    
    if (!existing) {
      return reply.code(404).send({ error: 'Showtime not found' });
    }
    
    db.prepare('DELETE FROM showtimes WHERE id = ?').run(Number(id));
    return { success: true };
  });
  
  // ===== HALLS =====
  
  fastify.get('/api/admin/halls', async () => {
    const halls = db.prepare('SELECT * FROM halls ORDER BY sortOrder').all() as Hall[];
    return { halls };
  });
  
  fastify.put('/api/admin/halls/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<Hall>;
    
    const existing = db.prepare('SELECT * FROM halls WHERE id = ?')
      .get(Number(id)) as Hall | undefined;
    
    if (!existing) {
      return reply.code(404).send({ error: 'Hall not found' });
    }
    
    db.prepare('UPDATE halls SET name = ?, sortOrder = ? WHERE id = ?').run(
      data.name ?? existing.name,
      data.sortOrder ?? existing.sortOrder,
      Number(id)
    );
    
    const hall = db.prepare('SELECT * FROM halls WHERE id = ?').get(Number(id)) as Hall;
    return { hall };
  });

  // Получить цены
  fastify.get('/api/admin/prices', async () => {
    try {
      const pricesPath = join(process.cwd(), '..', 'frontend', 'src', 'data', 'prices.json');
      const fileContent = readFileSync(pricesPath, 'utf-8');
      const pricesData = JSON.parse(fileContent);
      return { prices: pricesData.prices };
    } catch (error: any) {
      return { prices: [250, 300, 350, 400, 500] }; // Значения по умолчанию
    }
  });

  // Сохранить цены
  fastify.put('/api/admin/prices', async (request, reply) => {
    const data = request.body as { prices: number[] };
    
    if (!Array.isArray(data.prices)) {
      return reply.code(400).send({ error: 'prices must be an array' });
    }

    // Валидация: все элементы должны быть числами и положительными
    if (!data.prices.every(p => typeof p === 'number' && p > 0)) {
      return reply.code(400).send({ error: 'All prices must be positive numbers' });
    }

    try {
      const pricesPath = join(process.cwd(), '..', 'frontend', 'src', 'data', 'prices.json');
      const pricesData = { prices: data.prices };
      writeFileSync(pricesPath, JSON.stringify(pricesData, null, 2), 'utf-8');
      return { prices: data.prices };
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to save prices', message: error.message });
    }
  });

  // ===== PREMIERES =====
  
  // Директория для хранения загруженных видео
  const videosDir = join(process.cwd(), 'data', 'videos');
  if (!existsSync(videosDir)) {
    mkdirSync(videosDir, { recursive: true });
  }

  fastify.get('/api/admin/premieres', async () => {
    const premieres = db.prepare('SELECT * FROM premieres ORDER BY sortOrder, id').all() as Premier[];
    return { premieres };
  });

  // Загрузка видео файла
  fastify.post('/api/admin/premieres/upload', async (request, reply) => {
    fastify.log.info('Upload request received, headers:', {
      'content-type': request.headers['content-type'],
      'content-length': request.headers['content-length']
    });
    
    try {
      const data = await request.file();
      fastify.log.info('File data received:', {
        filename: data?.filename,
        mimetype: data?.mimetype,
        encoding: data?.encoding
      });
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Проверяем тип файла
      if (!data.mimetype.startsWith('video/')) {
        return reply.code(400).send({ 
          error: 'File must be a video',
          message: 'Загруженный файл не является видео. Пожалуйста, выберите видео файл.'
        });
      }

      // Генерируем уникальное имя файла с правильным расширением
      const originalName = data.filename || 'video';
      const fileExt = originalName.split('.').pop()?.toLowerCase() || 'mp4';
      
      // Проверяем, что расширение поддерживается браузером
      const browserSupportedFormats = ['mp4', 'webm', 'ogg'];
      const otherFormats = ['mov', 'avi', 'mkv'];
      
      if (!browserSupportedFormats.includes(fileExt) && !otherFormats.includes(fileExt)) {
        return reply.code(400).send({ 
          error: 'Unsupported video format',
          message: `Формат ${fileExt} не поддерживается. Используйте MP4, WebM или OGG для лучшей совместимости с браузерами.`
        });
      }
      
      // Предупреждаем о форматах, которые могут не работать в браузере
      if (otherFormats.includes(fileExt)) {
        fastify.log.warn(`Uploaded video format ${fileExt} may not be supported by all browsers. Consider converting to MP4.`);
      }
      
      const ext = fileExt;
      const fileName = `${randomUUID()}.${ext}`;
      const filePath = join(videosDir, fileName);

      // Сохраняем файл
      // data.file - это поток с содержимым файла
      const fileStream = data.file;
      fastify.log.info(`Starting upload: ${originalName} (${fileExt})`);
      
      const writeStream = createWriteStream(filePath);
      let bytesWritten = 0;
      
      // Отслеживаем прогресс
      fileStream.on('data', (chunk) => {
        bytesWritten += chunk.length;
        if (bytesWritten % (10 * 1024 * 1024) === 0) { // Логируем каждые 10MB
          fastify.log.info(`Upload progress: ${Math.round(bytesWritten / 1024 / 1024)}MB`);
        }
      });
      
      try {
        // Используем pipeline для безопасной передачи данных
        await pipeline(fileStream, writeStream);
        
        fastify.log.info(`File uploaded successfully: ${fileName}, size: ${bytesWritten} bytes`);
        const videoUrl = `/api/videos/${fileName}`;
        return reply.send({ videoUrl, fileName });
      } catch (error: any) {
        fastify.log.error('Error during file upload:', error);
        
        // Удаляем частично записанный файл
        try {
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        } catch (unlinkErr) {
          // Игнорируем ошибку удаления
        }
        
        return reply.code(500).send({ 
          error: 'Failed to upload video', 
          message: error?.message || 'Ошибка при загрузке видео файла' 
        });
      }
    } catch (error: any) {
      fastify.log.error('Upload error:', error);
      return reply.code(500).send({ 
        error: 'Failed to upload video', 
        message: error.message || 'Неизвестная ошибка при загрузке видео' 
      });
    }
  });

  fastify.post('/api/admin/premieres', async (request, reply) => {
    const data = request.body as Partial<Premier>;
    
    if (!data.title || !data.videoUrl) {
      return reply.code(400).send({ error: 'Title and videoUrl are required' });
    }

    // Получаем максимальный sortOrder
    const maxSort = db.prepare('SELECT MAX(sortOrder) as maxSort FROM premieres')
      .get() as { maxSort: number | null };
    const nextSort = (maxSort?.maxSort ?? -1) + 1;

    const result = db.prepare(`
      INSERT INTO premieres (title, videoUrl, sortOrder)
      VALUES (?, ?, ?)
    `).run(
      data.title,
      data.videoUrl,
      nextSort
    );

    const premier = db.prepare('SELECT * FROM premieres WHERE id = ?')
      .get(result.lastInsertRowid) as Premier;
    
    return { premier };
  });

  fastify.put('/api/admin/premieres/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<Premier>;
    
    const existing = db.prepare('SELECT * FROM premieres WHERE id = ?')
      .get(Number(id)) as Premier | undefined;
    
    if (!existing) {
      return reply.code(404).send({ error: 'Premier not found' });
    }

    // Если удаляется старое видео (заменяется на новое или удаляется полностью), удаляем файл
    const isVideoRemoved = !data.videoUrl || data.videoUrl === '';
    const isVideoReplaced = data.videoUrl && data.videoUrl !== existing.videoUrl;
    
    if ((isVideoRemoved || isVideoReplaced) && existing.videoUrl) {
      // Если старое видео было локальным файлом, удаляем его
      if (typeof existing.videoUrl === 'string' && existing.videoUrl.startsWith('/api/videos/')) {
        const oldFileName = existing.videoUrl.replace('/api/videos/', '');
        const oldFilePath = join(videosDir, oldFileName);
        
        fastify.log.info(`Attempting to delete old video file during update: ${oldFilePath}`);
        
        if (existsSync(oldFilePath)) {
          try {
            unlinkSync(oldFilePath);
            fastify.log.info(`Successfully deleted old video file: ${oldFilePath}`);
          } catch (err: any) {
            fastify.log.error(`Failed to delete old video file ${oldFilePath}:`, err?.message || err);
            // Продолжаем обновление даже если старый файл не удалился
          }
        } else {
          fastify.log.warn(`Old video file not found at path: ${oldFilePath}`);
        }
      }
    }

    // При редактировании не меняем sortOrder - он остается прежним
    db.prepare(`
      UPDATE premieres 
      SET title = ?, videoUrl = ?
      WHERE id = ?
    `).run(
      data.title ?? existing.title,
      data.videoUrl ?? existing.videoUrl,
      Number(id)
    );

    const premier = db.prepare('SELECT * FROM premieres WHERE id = ?')
      .get(Number(id)) as Premier;
    
    return { premier };
  });

  fastify.delete('/api/admin/premieres/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = db.prepare('SELECT * FROM premieres WHERE id = ?')
      .get(Number(id)) as Premier | undefined;
    
    if (!existing) {
      return reply.code(404).send({ error: 'Premier not found' });
    }

    // Удаляем файл, если это локальный файл
    if (existing.videoUrl && typeof existing.videoUrl === 'string' && existing.videoUrl.startsWith('/api/videos/')) {
      const fileName = existing.videoUrl.replace('/api/videos/', '');
      const filePath = join(videosDir, fileName);
      
      fastify.log.info(`Attempting to delete video file: ${filePath}`);
      
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
          fastify.log.info(`Successfully deleted video file: ${filePath}`);
        } catch (err: any) {
          fastify.log.error(`Failed to delete video file ${filePath}:`, err?.message || err);
          // Продолжаем удаление записи из БД даже если файл не удалился
        }
      } else {
        fastify.log.warn(`Video file not found at path: ${filePath}`);
      }
    } else if (existing.videoUrl) {
      fastify.log.info(`Video URL is not a local file, skipping file deletion: ${existing.videoUrl}`);
    }

    // Удаляем ролик
    db.prepare('DELETE FROM premieres WHERE id = ?').run(Number(id));
    
    // Пересчитываем sortOrder для всех оставшихся роликов (0, 1, 2, ...)
    const remainingPremieres = db.prepare('SELECT id FROM premieres ORDER BY sortOrder, id')
      .all() as Array<{ id: number }>;
    
    remainingPremieres.forEach((premier, index) => {
      db.prepare('UPDATE premieres SET sortOrder = ? WHERE id = ?')
        .run(index, premier.id);
    });
    
    return { success: true };
  });
}
