import { FastifyInstance } from 'fastify';
import { KINOPOISK_API_KEY, KINOPOISK_API_BASE } from '../config.js';
import { requireAuth } from '../auth.js';

interface KinopoiskMovieResponse {
  id: number;
  name: string;
  alternativeName?: string | null;
  enName?: string | null;
  year?: number;
  rating?: {
    kp?: number;
    imdb?: number;
  };
  genres?: Array<{ name: string } | string>;
  countries?: Array<{ name: string } | string>;
  duration?: number;
  description?: string | null;
  poster?: {
    url?: string;
    previewUrl?: string;
  } | string | null;
  ageRating?: number | null;
}

export async function kinopoiskRoutes(fastify: FastifyInstance) {
  // Требуем авторизацию для всех роутов
  fastify.addHook('onRequest', async (request, reply) => {
    await requireAuth(request, reply);
  });

  // Получение фильма по ID
  fastify.get('/api/kinopoisk/film/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!id || isNaN(Number(id))) {
      return reply.code(400).send({ error: 'Invalid film ID' });
    }

    try {
      // Используем poiskkino.dev API (один запрос)
      const url = new URL(`${KINOPOISK_API_BASE}/v1.4/movie`);
      url.searchParams.set('id', id);

      fastify.log.info(`Fetching film by ID: ${url.toString()}`);
      const response = await fetch(url.toString(), {
        headers: {
          'X-API-KEY': KINOPOISK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`Kinopoisk API error: ${response.status} - ${errorText}`);
        return reply.code(response.status).send({
          error: 'Kinopoisk API error',
          message: errorText,
        });
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        fastify.log.error(`Kinopoisk API returned non-JSON: ${text.substring(0, 200)}`);
        return reply.code(500).send({
          error: 'Invalid response from Kinopoisk API',
          message: 'API returned HTML instead of JSON',
        });
      }

      const rawData = await response.json() as any;
      fastify.log.info(`Film data keys: ${Object.keys(rawData).join(', ')}`);
      
      // Обрабатываем разные форматы ответа
      let data: KinopoiskMovieResponse;
      
      // kinopoisk.dev возвращает {docs: [фильм], ...} для запроса по ID
      if (rawData.docs && Array.isArray(rawData.docs)) {
        if (rawData.docs.length === 0) {
          return reply.code(404).send({
            error: 'Film not found',
            message: `Фильм с ID ${id} не найден.`,
          });
        }
        // Берем первый фильм из массива
        data = rawData.docs[0] as KinopoiskMovieResponse;
      } else if (rawData.id) {
        // Прямой объект фильма
        data = rawData as KinopoiskMovieResponse;
      } else if (rawData.data && rawData.data.id) {
        // Обёрнутый в data
        data = rawData.data as KinopoiskMovieResponse;
      } else if (rawData.movie && rawData.movie.id) {
        // Обёрнутый в movie
        data = rawData.movie as KinopoiskMovieResponse;
      } else {
        fastify.log.error(`Unknown film response format: ${JSON.stringify(rawData).substring(0, 500)}`);
        return reply.code(500).send({
          error: 'Invalid response format',
          message: 'Неверный формат ответа от API',
        });
      }

      // Преобразуем данные в формат для фронтенда
      const film = {
        id: data.id,
        kinopoiskId: data.id, // Сохраняем ID из Кинопоиска
        title: data.name || data.alternativeName || data.enName || 'Без названия',
        alternativeName: data.alternativeName,
        enName: data.enName,
        year: data.year,
        durationMin: data.duration || 90,
        description: data.description,
        posterUrl: typeof data.poster === 'string' 
          ? data.poster 
          : (data.poster?.url || data.poster?.previewUrl || null),
        ageRating: convertAgeRating(data.ageRating),
        rating: data.rating?.kp || data.rating?.imdb || null,
        genres: data.genres?.map((g: any) => (typeof g === 'string' ? g : g.name)) || [],
        countries: data.countries?.map((c: any) => (typeof c === 'string' ? c : c.name)) || [],
      };

      if (!film || !film.id) {
        return reply.code(404).send({
          error: 'Film not found',
          message: 'Фильм с указанным ID не найден',
        });
      }
      
      fastify.log.info(`Successfully processed film: ${film.title} (ID: ${film.id})`);
      return { film };
    } catch (error: any) {
      fastify.log.error({
        msg: 'Get film by ID error',
        error: error.message || String(error),
        stack: error.stack,
        filmId: id,
      });
      
      // Если это ошибка "не найдено", возвращаем 404
      if (error.message && (error.message.includes('Not found') || error.message.includes('not found'))) {
        return reply.code(404).send({
          error: 'Film not found',
          message: `Фильм с ID ${id} не найден. Попробуйте поиск по названию.`,
        });
      }
      
      return reply.code(500).send({
        error: 'Failed to get film',
        message: error.message || String(error) || 'Unknown error',
      });
    }
  });
}

// Конвертация возрастного рейтинга из числового формата (0, 6, 12, 16, 18) в строковый ('0+', '6+', и т.д.)
function convertAgeRating(ageRating: number | null | undefined): '0+' | '6+' | '12+' | '16+' | '18+' {
  if (!ageRating && ageRating !== 0) {
    return '0+';
  }

  if (ageRating >= 18) return '18+';
  if (ageRating >= 16) return '16+';
  if (ageRating >= 12) return '12+';
  if (ageRating >= 6) return '6+';
  return '0+';
}
