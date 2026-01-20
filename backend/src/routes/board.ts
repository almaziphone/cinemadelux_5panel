import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { BoardResponse, BoardFilm, BoardShowtime, Premier } from '../types';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.get('/api/board', async (request) => {
    const { date } = request.query as { date?: string };
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Получаем все залы для маппинга
    const halls = db.prepare('SELECT * FROM halls').all() as Array<{
      id: number;
      name: string;
    }>;
    const hallMap = new Map(halls.map(h => [h.id, h.name]));
    
    // Вычисляем дату завтра для получения сеансов на сегодня и завтра
    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const tomorrowDateObj = new Date(targetDateObj);
    tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
    const tomorrowDate = tomorrowDateObj.toISOString().split('T')[0];
    
    // Получаем сеансы на указанную дату и завтра (только активные фильмы и не скрытые сеансы)
    const showtimes = db.prepare(`
      SELECT 
        s.id,
        s.hallId,
        s.startAt,
        s.endAt,
        s.priceFrom,
        s.note,
        f.id as filmId,
        f.title,
        f.posterUrl,
        f.format,
        f.ageRating,
        f.durationMin,
        f.description
      FROM showtimes s
      JOIN films f ON s.filmId = f.id
      WHERE (DATE(s.startAt) = ? OR DATE(s.startAt) = ?)
        AND s.isHidden = 0
        AND f.isActive = 1
      ORDER BY f.title, s.startAt
    `).all(targetDate, tomorrowDate) as Array<{
      id: number;
      hallId: number;
      startAt: string;
      endAt: string;
      priceFrom: number | null;
      note: string | null;
      filmId: number;
      title: string;
      posterUrl: string | null;
      format: string | null;
      ageRating: string;
      durationMin: number;
      description: string | null;
    }>;
    
    // Группируем по фильмам
    const filmMap = new Map<number, BoardFilm>();
    
    showtimes.forEach(s => {
      if (!filmMap.has(s.filmId)) {
        const startDate = new Date(s.startAt);
        const time = startDate.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Yekaterinburg'
        });
        
        filmMap.set(s.filmId, {
          id: s.filmId,
          title: s.title,
          posterUrl: s.posterUrl,
          ageRating: s.ageRating,
          format: s.format,
          durationMin: s.durationMin,
          description: s.description,
          showtimes: [{
            id: s.id,
            startAt: s.startAt,
            time,
            endAt: s.endAt,
            hallId: s.hallId,
            hallName: hallMap.get(s.hallId) || `Зал ${s.hallId}`,
            priceFrom: s.priceFrom,
            note: s.note
          }]
        });
      } else {
        const film = filmMap.get(s.filmId)!;
        const startDate = new Date(s.startAt);
        const time = startDate.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Yekaterinburg'
        });
        
        film.showtimes.push({
          id: s.id,
          startAt: s.startAt,
          time,
          endAt: s.endAt,
          hallId: s.hallId,
          hallName: hallMap.get(s.hallId) || `Зал ${s.hallId}`,
          priceFrom: s.priceFrom,
          note: s.note
        });
      }
    });
    
    // Сортируем сеансы внутри каждого фильма по времени
    const films = Array.from(filmMap.values()).map(film => ({
      ...film,
      showtimes: film.showtimes.sort((a, b) => 
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      )
    }));
    
    // Сортируем фильмы по времени первого сеанса
    films.sort((a, b) => {
      const timeA = a.showtimes[0] ? new Date(a.showtimes[0].startAt).getTime() : 0;
      const timeB = b.showtimes[0] ? new Date(b.showtimes[0].startAt).getTime() : 0;
      return timeA - timeB;
    });
    
    const response: BoardResponse = {
      date: targetDate,
      films
    };
    
    return response;
  });

  // Получить премьеры (публичный роут)
  fastify.get('/api/board/premieres', async () => {
    const premieres = db.prepare('SELECT * FROM premieres ORDER BY sortOrder, id').all() as Premier[];
    return { premieres };
  });
}
