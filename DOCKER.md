# Docker инструкции

> **Для развертывания на Synology Rackstation см. [SYNOLOGY.md](./SYNOLOGY.md)**

## Создание Docker-образа

Есть два способа создать Docker-образ:

### Способ 1: Через Docker Compose (рекомендуется)

```bash
# Сборка образа
docker-compose build

# Сборка с пересозданием кэша (если нужно)
docker-compose build --no-cache

# Сборка и сразу запуск
docker-compose up -d --build
```

### Способ 2: Через Docker напрямую

```bash
# Сборка образа с тегом
docker build -t cinema-app:latest -f backend/Dockerfile .

# Просмотр созданных образов
docker images | grep cinema-app

# Запуск контейнера из образа
docker run -d \
  --name cinema-app \
  -p 8080:8080 \
  -v ./data:/app/data \
  cinema-app:latest
```

## Быстрый старт

### Сборка и запуск

```bash
# Сборка образа
docker-compose build

# Запуск контейнера
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

### Доступ к приложению

После запуска приложение будет доступно по адресу:
- **Frontend и API**: http://localhost:8080

### Данные

База данных и видео файлы сохраняются в директории `./data` на хосте (монтируется как volume).

### Пересборка после изменений

```bash
# Пересборка образа
docker-compose build --no-cache

# Перезапуск контейнера
docker-compose up -d --force-recreate
```

### Просмотр логов

```bash
# Все логи
docker-compose logs

# Логи в реальном времени
docker-compose logs -f

# Логи только приложения
docker-compose logs app
```

### Остановка и удаление

```bash
# Остановка контейнера
docker-compose down

# Остановка и удаление volumes (удалит данные!)
docker-compose down -v
```

## Структура

- `backend/Dockerfile` - Dockerfile для сборки приложения (включает frontend и backend)
- `docker-compose.yml` - Конфигурация Docker Compose
- `.dockerignore` - Игнорируемые файлы при сборке

## Переменные окружения

Можно настроить через файл `.env` или в `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
```

## Проблемы

### Порт уже занят

Если порт 8080 занят, измените в `docker-compose.yml`:

```yaml
ports:
  - "8081:8080"  # Используйте другой порт
```

### Проблемы с правами доступа

На Linux может потребоваться настроить права на директорию `data`:

```bash
sudo chown -R $USER:$USER ./data
```
