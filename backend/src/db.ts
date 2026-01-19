import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbDir = join(process.cwd(), 'data');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'cinema.db');
export const db = new Database(dbPath);

// Включаем foreign keys
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Таблица залов
  db.exec(`
    CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY CHECK(id BETWEEN 1 AND 5),
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Таблица фильмов
  db.exec(`
    CREATE TABLE IF NOT EXISTS films (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      durationMin INTEGER NOT NULL CHECK(durationMin > 0),
      ageRating TEXT NOT NULL CHECK(ageRating IN ('0+', '6+', '12+', '16+', '18+')),
      format TEXT,
      description TEXT,
      posterUrl TEXT,
      isActive INTEGER NOT NULL DEFAULT 1 CHECK(isActive IN (0, 1)),
      kinopoiskId INTEGER
    )
  `);
  
  // Добавляем колонку kinopoiskId, если её нет (для существующих БД)
  // SQLite не поддерживает UNIQUE в ALTER TABLE, поэтому добавляем без UNIQUE
  // и создаем уникальный индекс отдельно
  try {
    const tableInfo = db.prepare("PRAGMA table_info(films)").all() as Array<{ name: string }>;
    const hasKinopoiskId = tableInfo.some(col => col.name === 'kinopoiskId');
    
    if (!hasKinopoiskId) {
      console.log('Adding kinopoiskId column to films table...');
      db.exec('ALTER TABLE films ADD COLUMN kinopoiskId INTEGER');
      console.log('kinopoiskId column added successfully');
    } else {
      console.log('kinopoiskId column already exists');
    }
    
    // Создаем уникальный индекс для kinopoiskId (SQLite разрешает несколько NULL)
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_films_kinopoiskId ON films(kinopoiskId)');
    console.log('kinopoiskId unique index created/verified');
  } catch (err: any) {
    // Игнорируем ошибку, если индекс уже существует или другая проблема
    console.error('Error adding kinopoiskId column or index:', err.message);
  }

  // Таблица сеансов
  db.exec(`
    CREATE TABLE IF NOT EXISTS showtimes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hallId INTEGER NOT NULL,
      filmId INTEGER NOT NULL,
      startAt TEXT NOT NULL,
      endAt TEXT NOT NULL,
      priceFrom INTEGER,
      note TEXT,
      isHidden INTEGER NOT NULL DEFAULT 0 CHECK(isHidden IN (0, 1)),
      FOREIGN KEY (hallId) REFERENCES halls(id) ON DELETE CASCADE,
      FOREIGN KEY (filmId) REFERENCES films(id) ON DELETE CASCADE
    )
  `);

  // Таблица пользователей (для админки)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL
    )
  `);

  // Таблица сессий
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Инициализация залов, если их нет
  const hallsCount = db.prepare('SELECT COUNT(*) as count FROM halls').get() as { count: number };
  if (hallsCount.count === 0) {
    const insertHall = db.prepare('INSERT INTO halls (id, name, sortOrder) VALUES (?, ?, ?)');
    for (let i = 1; i <= 5; i++) {
      insertHall.run(i, `Зал ${i}`, i);
    }
  }

  // Создание дефолтного админа, если его нет
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (usersCount.count === 0) {
    // Пароль: admin (в реальном проекте нужно использовать bcrypt)
    // Для простоты используем простой хеш
    const adminPassword = 'admin'; // В продакшене должен быть хеш
    db.prepare('INSERT INTO users (username, passwordHash) VALUES (?, ?)').run('admin', adminPassword);
  }

  // Индексы для производительности
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_showtimes_hall_start ON showtimes(hallId, startAt);
    CREATE INDEX IF NOT EXISTS idx_showtimes_film ON showtimes(filmId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);
  `);
}
