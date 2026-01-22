# Backend Dockerfile (multi-stage с frontend)
# Контекст сборки: корень проекта

# Этап 1: Сборка frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем и собираем frontend
COPY frontend/package.json frontend/package-lock.json* ./
# npm install работает и с lock файлом, и без него
RUN npm install

COPY frontend ./
RUN npm run build

# Этап 2: Сборка backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Копируем package.json и устанавливаем зависимости
COPY backend/package.json backend/package-lock.json* ./
# npm install работает и с lock файлом, и без него
RUN npm install

# Копируем исходный код backend
COPY backend ./

# Собираем TypeScript
RUN npm run build

# Этап 3: Production образ
FROM node:20-alpine

WORKDIR /app

# Устанавливаем только production зависимости для backend
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY --from=backend-builder /app/backend/package-lock.json* ./backend/
WORKDIR /app/backend
# npm install работает и с lock файлом, и без него
RUN npm install --only=production

# Копируем собранный backend код
COPY --from=backend-builder /app/backend/dist ./dist

# Копируем собранный frontend в место, где backend его ожидает
# backend ищет frontend/dist относительно process.cwd() (который будет /app/backend)
# поэтому путь должен быть ../frontend/dist
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

WORKDIR /app

# Создаем директорию для данных
RUN mkdir -p /app/data/videos

# Копируем исходный prices.json как шаблон для инициализации
COPY --chown=node:node frontend/src/data/prices.json /app/data/prices.json.initial

# Открываем порт
EXPOSE 8080

WORKDIR /app/backend

# Запускаем приложение
CMD ["node", "dist/index.js"]
