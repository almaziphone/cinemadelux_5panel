import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { initDatabase, db } from '../backend/src/db';
import { KINOPOISK_API_KEY, KINOPOISK_API_BASE } from '../backend/src/config';

const require = createRequire(import.meta.url);
const { parsePDF: parsePDFJS } = require('./parse-pdf.js');

interface ParsedSession {
  hall: number;
  time: string;
  duration: number;
  title: string;
  format: string;
  isHidden: boolean; // для сеансов с ***
}

interface FilmInfo {
  title: string;
  duration: number;
  format: string;
  ageRating?: string;
  kinopoiskId?: number;
}

// Функция для поиска фильма в Кинопоиске
async function searchKinopoiskId(title: string): Promise<number | null> {
  try {
    // Используем правильный endpoint для поиска
    const url = new URL(`${KINOPOISK_API_BASE}/v1.4/movie/search`);
    url.searchParams.set('query', title);
    url.searchParams.set('limit', '10'); // Берем больше результатов для лучшего поиска

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': KINOPOISK_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  API вернул статус ${response.status} для "${title}": ${errorText.substring(0, 100)}`);
      return null;
    }

    const data = await response.json();
    
    // API возвращает {docs: [фильмы], ...} или {data: {docs: [...]}}
    let films: any[] = [];
    if (data.docs && Array.isArray(data.docs)) {
      films = data.docs;
    } else if (data.data && data.data.docs && Array.isArray(data.data.docs)) {
      films = data.data.docs;
    } else if (Array.isArray(data)) {
      films = data;
    } else if (data.id) {
      films = [data];
    }
    
    if (films.length === 0) {
      console.log(`  ⚠️  Фильмы не найдены для "${title}"`);
      return null;
    }
    
    // Ищем наиболее подходящий фильм по названию
    // Сначала ищем точное совпадение
    const exactMatch = films.find((f: any) => {
      const filmName = (f.name || f.title || f.alternativeName || '').toLowerCase().trim();
      const searchTitle = title.toLowerCase().trim();
      return filmName === searchTitle;
    });
    
    if (exactMatch) {
      const filmName = exactMatch.name || exactMatch.title || exactMatch.alternativeName || 'Без названия';
      console.log(`  ✓ Найден (точное совпадение): "${filmName}" (ID: ${exactMatch.id})`);
      return exactMatch.id;
    }
    
    // Ищем частичное совпадение в названии
    const partialMatch = films.find((f: any) => {
      const filmName = (f.name || f.title || f.alternativeName || '').toLowerCase();
      const searchTitle = title.toLowerCase();
      return filmName.includes(searchTitle) || searchTitle.includes(filmName);
    });
    
    if (partialMatch) {
      const filmName = partialMatch.name || partialMatch.title || partialMatch.alternativeName || 'Без названия';
      console.log(`  ✓ Найден (частичное совпадение): "${filmName}" (ID: ${partialMatch.id})`);
      return partialMatch.id;
    }
    
    // Берем первый результат, но предупреждаем
    const film = films[0];
    const filmName = film.name || film.title || film.alternativeName || 'Без названия';
    console.log(`  ⚠️  Найден (первый результат): "${filmName}" (ID: ${film.id}) - возможно неверный`);
    return film.id;

  } catch (error: any) {
    console.error(`  Ошибка при поиске "${title}":`, error.message);
    return null;
  }
}

// Функция для парсинга PDF - извлекает шаблоны сеансов (без дат)
interface SessionTemplate {
  hall: number;
  hours: number;
  minutes: number;
  duration: number;
  title: string;
  format: string;
  isHidden: boolean;
}

async function parsePDF(pdfPath: string): Promise<SessionTemplate[]> {
  // Используем CommonJS модуль для парсинга PDF
  const text = await parsePDFJS(pdfPath);

  const templates: SessionTemplate[] = [];
  const lines = text.split('\n');

  let currentHall = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Определяем зал
    const hallMatch = line.match(/Зал №(\d+)/);
    if (hallMatch) {
      currentHall = parseInt(hallMatch[1]);
      continue;
    }

    if (currentHall === 0) continue;

    // Парсим сеанс: время, длительность, название, формат
    // Формат: "10:05 118 минут Чебурашка 2 2D"
    // Или: "08:00*** --- Океан чудес ---" (сеанс только для кассиров)
    // Или: "00:20* 93 минуты Синистер. Первое проклятие 2D" (условный сеанс)
    
    // Сначала проверяем сеансы только для кассиров (***)
    const cashierOnlyMatch = line.match(/^(\d{2}):(\d{2})\*\*\*\s+---\s+(.+?)\s+---$/);
    if (cashierOnlyMatch && currentHall > 0) {
      const hours = parseInt(cashierOnlyMatch[1]);
      const minutes = parseInt(cashierOnlyMatch[2]);
      const title = cashierOnlyMatch[3].trim();
      
      templates.push({
        hall: currentHall,
        hours,
        minutes,
        duration: 0, // Для сеансов только для кассиров длительность не указана
        title,
        format: '2D',
        isHidden: true, // *** означает скрытый сеанс
      });
      continue;
    }

    // Обычные сеансы с длительностью
    // Формат: "10:05 118 минут Чебурашка 2 2D" или "00:20* 93 минуты Синистер. Первое проклятие 2D"
    const sessionMatch = line.match(/^(\d{2}):(\d{2})(\*)?\s+(\d+)\s+минут(?:ы|а)?\s+(.+?)\s+(2D|3D|IMAX)$/);
    if (sessionMatch && currentHall > 0) {
      const hours = parseInt(sessionMatch[1]);
      const minutes = parseInt(sessionMatch[2]);
      const duration = parseInt(sessionMatch[4]);
      const title = sessionMatch[5].trim();
      const format = sessionMatch[6];

      templates.push({
        hall: currentHall,
        hours,
        minutes,
        duration,
        title,
        format,
        isHidden: false, // Условные сеансы (*) не скрываем, они просто условные
      });
    }
  }

  return templates;
}

// Создаем сеансы для каждого дня недели
function createSessionsForWeek(templates: SessionTemplate[]): ParsedSession[] {
  const sessions: ParsedSession[] = [];
  const startDate = new Date('2026-01-15');
  
  // Создаем сеансы для каждого дня с 15 по 21 января
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    
    for (const template of templates) {
      let hours = template.hours;
      let sessionDate = dateStr;
      
      // Сеансы после полуночи (0:00 - 3:00) относятся к предыдущему дню
      // Например, сеанс в 0:15, 0:50 или 1:00 относится к предыдущему дню
      if (hours >= 0 && hours < 4 && dayOffset > 0) {
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        sessionDate = prevDate.toISOString().split('T')[0];
      }
      
      const timeString = `${sessionDate}T${String(hours).padStart(2, '0')}:${String(template.minutes).padStart(2, '0')}:00+05:00`;
      
      sessions.push({
        hall: template.hall,
        time: timeString,
        duration: template.duration,
        title: template.title,
        format: template.format,
        isHidden: template.isHidden,
      });
    }
  }
  
  return sessions;
}

// Функция для определения возрастного рейтинга (по умолчанию 0+)
function getAgeRating(title: string): string {
  // Можно добавить логику определения рейтинга по названию
  // Пока возвращаем 0+ по умолчанию
  return '0+';
}

async function main() {
  const pdfPath = 'c:\\Users\\almaz.OAS\\Downloads\\Сеансы_Нягань_15-21.01.26.pdf';

  // Меняем рабочую директорию на backend, чтобы использовать правильную базу данных
  const originalCwd = process.cwd();
  process.chdir(join(originalCwd, 'backend'));

  console.log('Инициализация базы данных...');
  initDatabase();

  console.log('Удаление всех существующих фильмов и сеансов...');
  // Удаляем все сеансы (фильмы удалятся автоматически через CASCADE, если нет других сеансов)
  db.exec('DELETE FROM showtimes');
  db.exec('DELETE FROM films');

  console.log('Парсинг PDF файла...');
  const templates = await parsePDF(pdfPath);
  console.log(`Найдено шаблонов сеансов: ${templates.length}`);
  
  console.log('Создание сеансов для недели (15-21 января)...');
  const sessions = createSessionsForWeek(templates);
  console.log(`Создано сеансов: ${sessions.length}`);

  // Собираем уникальные фильмы
  const filmsMap = new Map<string, FilmInfo>();
  for (const session of sessions) {
    if (!filmsMap.has(session.title)) {
      filmsMap.set(session.title, {
        title: session.title,
        duration: session.duration,
        format: session.format,
        ageRating: getAgeRating(session.title),
      });
    }
  }

  console.log(`\nНайдено уникальных фильмов: ${filmsMap.size}`);
  console.log('Поиск ID кинопоиска для фильмов...\n');

  // Ищем ID кинопоиска для каждого фильма
  const usedKinopoiskIds = new Set<number>();
  
  for (const [title, filmInfo] of filmsMap.entries()) {
    console.log(`Поиск: "${title}"...`);
    const kinopoiskId = await searchKinopoiskId(title);
    if (kinopoiskId && !usedKinopoiskIds.has(kinopoiskId)) {
      filmInfo.kinopoiskId = kinopoiskId;
      usedKinopoiskIds.add(kinopoiskId);
    } else if (kinopoiskId && usedKinopoiskIds.has(kinopoiskId)) {
      console.log(`  ⚠️  ID кинопоиска ${kinopoiskId} уже используется другим фильмом, пропускаем`);
      filmInfo.kinopoiskId = undefined;
    } else {
      console.log(`  ⚠️  ID кинопоиска не найден для "${title}"`);
    }
    // Небольшая задержка, чтобы не перегружать API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\nДобавление фильмов в базу данных...');
  const filmIds = new Map<string, number>();

  for (const [title, filmInfo] of filmsMap.entries()) {
    // Пропускаем фильмы с нулевой длительностью (сеансы только для кассиров)
    // Они будут созданы позже при добавлении сеансов
    if (filmInfo.duration === 0) {
      continue;
    }
    
    const result = db.prepare(`
      INSERT INTO films (title, durationMin, ageRating, format, kinopoiskId, isActive)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      filmInfo.title,
      filmInfo.duration,
      filmInfo.ageRating || '0+',
      filmInfo.format,
      filmInfo.kinopoiskId || null
    );

    filmIds.set(title, Number(result.lastInsertRowid));
    console.log(`  ✓ Добавлен фильм: "${title}" (ID: ${result.lastInsertRowid}${filmInfo.kinopoiskId ? `, Кинопоиск: ${filmInfo.kinopoiskId}` : ''})`);
  }

  console.log('\nДобавление сеансов в базу данных...');
  let addedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    let filmId = filmIds.get(session.title);
    
    // Для сеансов только для кассиров (без длительности) создаем фильм с дефолтной длительностью
    if (!filmId && session.duration === 0) {
      const result = db.prepare(`
        INSERT INTO films (title, durationMin, ageRating, format, isActive)
        VALUES (?, ?, ?, ?, 1)
      `).run(
        session.title,
        90, // Дефолтная длительность для сеансов только для кассиров
        '0+',
        session.format
      );
      filmId = Number(result.lastInsertRowid);
      filmIds.set(session.title, filmId);
    }

    if (!filmId) {
      console.log(`  ⚠️  Пропущен сеанс: фильм "${session.title}" не найден`);
      skippedCount++;
      continue;
    }

    // Вычисляем время окончания
    const startDate = new Date(session.time);
    // Используем длительность из сеанса или дефолтную (90 минут)
    const duration = session.duration > 0 ? session.duration : 90;
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    
    const endAt = endDate.toISOString();

    try {
      db.prepare(`
        INSERT INTO showtimes (hallId, filmId, startAt, endAt, isHidden)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        session.hall,
        filmId,
        startDate.toISOString(),
        endAt,
        session.isHidden ? 1 : 0
      );
      addedCount++;
    } catch (error: any) {
      console.log(`  ⚠️  Ошибка при добавлении сеанса: ${error.message}`);
      skippedCount++;
    }
  }

  // Возвращаем рабочую директорию
  process.chdir(originalCwd);

  console.log(`\n✅ Импорт завершен!`);
  console.log(`   Добавлено сеансов: ${addedCount}`);
  console.log(`   Пропущено сеансов: ${skippedCount}`);
  console.log(`   Добавлено фильмов: ${filmsMap.size}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Ошибка:', error);
  process.exit(1);
});
