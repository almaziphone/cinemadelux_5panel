import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { requireAuth } from '../auth';
import { Film, Showtime, Hall } from '../types';

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
    const { date, hallId } = request.query as { date?: string; hallId?: string };
    
    let query = 'SELECT s.*, f.title as filmTitle, f.durationMin as filmDuration FROM showtimes s';
    query += ' JOIN films f ON s.filmId = f.id';
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (date) {
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
    
    // Проверка конфликтов
    const conflicts = db.prepare(`
      SELECT id FROM showtimes 
      WHERE hallId = ? 
        AND isHidden = 0
        AND (
          (startAt < ? AND endAt > ?) OR
          (startAt < ? AND endAt > ?) OR
          (startAt >= ? AND endAt <= ?)
        )
    `).all(
      data.hallId,
      data.startAt, data.startAt,
      endAt, endAt,
      data.startAt, endAt
    ) as { id: number }[];
    
    if (conflicts.length > 0) {
      return reply.code(409).send({ 
        error: 'Showtime conflict',
        message: 'Сеанс пересекается с существующим сеансом в этом зале'
      });
    }
    
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
    
    // Проверка конфликтов (исключая текущий сеанс)
    const conflicts = db.prepare(`
      SELECT id FROM showtimes 
      WHERE hallId = ? 
        AND id != ?
        AND isHidden = 0
        AND (
          (startAt < ? AND endAt > ?) OR
          (startAt < ? AND endAt > ?) OR
          (startAt >= ? AND endAt <= ?)
        )
    `).all(
      hallId,
      Number(id),
      startAt, startAt,
      endAt, endAt,
      startAt, endAt
    ) as { id: number }[];
    
    if (conflicts.length > 0) {
      return reply.code(409).send({ 
        error: 'Showtime conflict',
        message: 'Сеанс пересекается с существующим сеансом в этом зале'
      });
    }
    
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
}
