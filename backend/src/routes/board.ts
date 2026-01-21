import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { BoardResponse, BoardFilm, BoardShowtime, Premier } from '../types';

export async function boardRoutes(fastify: FastifyInstance) {
  // Функция для получения текущей даты в часовом поясе Екатеринбурга
  function getCurrentDateInYekaterinburg(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Yekaterinburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  fastify.get('/api/board', async (request) => {
    const { date } = request.query as { date?: string };
    
    // Используем переданную дату или текущую дату в часовом поясе Екатеринбурга
    const targetDate = date || getCurrentDateInYekaterinburg();
    
    // Получаем все залы для маппинга
    const halls = db.prepare('SELECT * FROM halls').all() as Array<{
      id: number;
      name: string;
    }>;
    const hallMap = new Map(halls.map(h => [h.id, h.name]));
    
    // Вычисляем дату завтра в часовом поясе Екатеринбурга
    // Парсим targetDate и добавляем один день
    const targetDateParts = targetDate.split('-');
    const targetYear = parseInt(targetDateParts[0]);
    const targetMonth = parseInt(targetDateParts[1]) - 1; // месяц начинается с 0
    const targetDay = parseInt(targetDateParts[2]);
    
    // Создаем дату в UTC, но используем полдень для надежности
    const targetDateObj = new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));
    const tomorrowDateObj = new Date(targetDateObj);
    tomorrowDateObj.setUTCDate(tomorrowDateObj.getUTCDate() + 1);
    
    // Конвертируем обратно в часовой пояс Екатеринбурга
    const tomorrowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Yekaterinburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const tomorrowParts = tomorrowFormatter.formatToParts(tomorrowDateObj);
    const tomorrowYear = tomorrowParts.find(p => p.type === 'year')?.value;
    const tomorrowMonth = tomorrowParts.find(p => p.type === 'month')?.value;
    const tomorrowDay = tomorrowParts.find(p => p.type === 'day')?.value;
    const tomorrowDate = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
    
    // Получаем все сеансы (только активные фильмы и не скрытые сеансы)
    // Фильтруем по датам в JavaScript с учетом часового пояса Екатеринбурга
    const allShowtimes = db.prepare(`
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
      WHERE s.isHidden = 0
        AND f.isActive = 1
      ORDER BY f.title, s.startAt
    `).all() as Array<{
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
    
    // Функция для получения даты сеанса в часовом поясе Екатеринбурга
    // Сеансы после полуночи (0:00 - 3:59) относятся к предыдущему дню
    function getShowtimeDateInYekaterinburg(startAt: string): string {
      const date = new Date(startAt);
      
      // Получаем час в часовом поясе Екатеринбурга
      const hourFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Yekaterinburg',
        hour: '2-digit',
        hour12: false
      });
      const hourParts = hourFormatter.formatToParts(date);
      const hour = parseInt(hourParts.find(p => p.type === 'hour')?.value || '0');
      
      // Если сеанс между 0:00 и 3:59, относим к предыдущему дню
      if (hour >= 0 && hour < 4) {
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Yekaterinburg',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const parts = formatter.formatToParts(prevDate);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        return `${year}-${month}-${day}`;
      }
      
      // Для остальных сеансов используем обычную дату
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Yekaterinburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      return `${year}-${month}-${day}`;
    }
    
    // Фильтруем сеансы по датам в часовом поясе Екатеринбурга с дедупликацией
    const seenIds = new Set<number>();
    const showtimes = allShowtimes.filter(s => {
      // Пропускаем дубликаты по ID
      if (seenIds.has(s.id)) {
        return false;
      }
      
      const showtimeDate = getShowtimeDateInYekaterinburg(s.startAt);
      const matches = showtimeDate === targetDate || showtimeDate === tomorrowDate;
      
      if (matches) {
        seenIds.add(s.id);
      }
      
      return matches;
    });
    
    // Группируем по фильмам с дедупликацией по ID сеанса и по времени
    const filmMap = new Map<number, BoardFilm>();
    const addedShowtimeIds = new Set<number>(); // Для отслеживания уже добавленных сеансов по ID
    const filmShowtimeKeys = new Map<number, Set<string>>(); // Для отслеживания времени сеансов для каждого фильма
    
    showtimes.forEach(s => {
      // Пропускаем дубликаты по ID
      if (addedShowtimeIds.has(s.id)) {
        return;
      }
      
      const startDate = new Date(s.startAt);
      const time = startDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Yekaterinburg'
      });
      
      // Проверяем, не добавлен ли уже сеанс с таким же временем для этого фильма
      if (!filmShowtimeKeys.has(s.filmId)) {
        filmShowtimeKeys.set(s.filmId, new Set());
      }
      const timeKey = `${time}_${s.hallId}`; // Учитываем и время, и зал
      
      // Если сеанс с таким же временем и залом уже есть, пропускаем
      if (filmShowtimeKeys.get(s.filmId)!.has(timeKey)) {
        return;
      }
      
      if (!filmMap.has(s.filmId)) {
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
        addedShowtimeIds.add(s.id);
        filmShowtimeKeys.get(s.filmId)!.add(timeKey);
      } else {
        const film = filmMap.get(s.filmId)!;
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
        addedShowtimeIds.add(s.id);
        filmShowtimeKeys.get(s.filmId)!.add(timeKey);
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
