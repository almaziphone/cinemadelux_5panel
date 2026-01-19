# Быстрый старт

## 1. Установка зависимостей

```bash
npm run install:all
```

## 2. Запуск в режиме разработки

```bash
npm run dev
```

Откройте:
- Табло: http://localhost:5173/board
- Админка: http://localhost:5173/admin (логин: `admin`, пароль: `admin`)

## 3. Production сборка и запуск

```bash
npm run build
npm run start
```

Откройте: http://localhost:8080/board

## 4. Kiosk режим (Windows)

```bash
scripts\start-kiosk.bat
```

Скрипт автоматически:
1. Соберёт проект (если нужно)
2. Запустит сервер
3. Откроет Chrome в полноэкранном режиме

## Первые шаги

1. Войдите в админку: http://localhost:8080/admin
2. Добавьте несколько фильмов
3. Создайте сеансы для разных залов
4. Откройте табло: http://localhost:8080/board

## Важно

- По умолчанию создан пользователь: `admin` / `admin`
- В продакшене обязательно измените пароль!
- База данных создаётся автоматически в `backend/data/cinema.db`
