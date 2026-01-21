# Развертывание на Synology Rackstation

## Подготовка

### 1. Установка Docker на Synology

1. Откройте **Центр пакетов** (Package Center)
2. Найдите и установите **Docker**
3. После установки откройте приложение **Docker**

### 2. Загрузка файлов проекта

#### Вариант A: Через File Station (веб-интерфейс)

1. Откройте **File Station**
2. Создайте папку `/docker/cinemadelux_5panel/`
3. Загрузите все файлы проекта:
   - `backend/` (вся папка)
   - `frontend/` (вся папка)
   - `docker-compose.synology.yml`
   - `.dockerignore`
   - `package.json` (корневой)
   - Все остальные файлы проекта

#### Вариант B: Через Git (если установлен)

```bash
cd /volume1/docker
git clone <ваш-репозиторий> cinemadelux_5panel
cd cinemadelux_5panel
```

#### Вариант C: Через SCP (с локальной машины)

```bash
# На локальной машине (Windows PowerShell или Linux/Mac)
scp -r backend frontend docker-compose.synology.yml .dockerignore package.json admin@<IP-Synology>:/volume1/docker/cinemadelux_5panel/
```

## Установка и запуск

### Шаг 1: Подключитесь по SSH

```bash
ssh admin@<IP-адрес-Synology>
```

### Шаг 2: Перейдите в директорию проекта

```bash
cd /volume1/docker/cinemadelux_5panel
```

### Шаг 3: Создайте директорию для данных

```bash
mkdir -p data/videos
chmod -R 755 data
```

### Шаг 4: Соберите Docker образ

```bash
sudo docker-compose -f docker-compose.synology.yml build
```

Это займет несколько минут. Образ будет собран с frontend и backend.

### Шаг 5: Запустите контейнер

```bash
sudo docker-compose -f docker-compose.synology.yml up -d
```

### Шаг 6: Проверьте статус

```bash
sudo docker-compose -f docker-compose.synology.yml ps
```

Должен показать запущенный контейнер `cinema-app`.

## Доступ к приложению

После успешного запуска приложение будет доступно по адресу:

- **Табло**: `http://<IP-адрес-Synology>:8080/board`
- **Админка**: `http://<IP-адрес-Synology>:8080/admin`
  - Логин: `admin`
  - Пароль: `733337` (из `backend/src/config.ts`)

## Управление контейнером

### Просмотр логов

```bash
# Все логи
sudo docker-compose -f docker-compose.synology.yml logs

# Логи в реальном времени
sudo docker-compose -f docker-compose.synology.yml logs -f

# Логи только приложения
sudo docker logs cinema-app
```

### Остановка контейнера

```bash
sudo docker-compose -f docker-compose.synology.yml down
```

### Перезапуск контейнера

```bash
sudo docker-compose -f docker-compose.synology.yml restart
```

### Обновление приложения

Если вы обновили код:

```bash
# Обновите файлы (через git pull или загрузите новые файлы)
git pull  # если используете git

# Пересоберите образ
sudo docker-compose -f docker-compose.synology.yml build

# Перезапустите контейнер
sudo docker-compose -f docker-compose.synology.yml up -d --force-recreate
```

## Структура данных

Все данные сохраняются в `/volume1/docker/cinemadelux_5panel/data/`:

- `cinema.db` - база данных SQLite
- `videos/` - загруженные видео файлы

**Важно:** Эта директория монтируется как volume, поэтому данные сохраняются даже после перезапуска контейнера.

## Решение проблем

### Ошибка Permission denied

Если получаете ошибку `PermissionError: [Errno 13] Permission denied`:

```bash
# Всегда используйте sudo для команд docker/docker-compose
sudo docker-compose -f docker-compose.synology.yml build
sudo docker-compose -f docker-compose.synology.yml up -d
```

### Порт 8080 занят

Если порт 8080 занят, измените в `docker-compose.synology.yml`:

```yaml
ports:
  - "8081:8080"  # Используйте другой порт
```

Затем перезапустите контейнер.

### Контейнер не запускается

Проверьте логи:

```bash
sudo docker-compose -f docker-compose.synology.yml logs
```

Убедитесь, что директория данных существует:

```bash
ls -la /volume1/docker/cinemadelux_5panel/data
```

### Пересборка с нуля

Если нужно пересобрать образ без кэша:

```bash
sudo docker-compose -f docker-compose.synology.yml build --no-cache
sudo docker-compose -f docker-compose.synology.yml up -d --force-recreate
```

## Автозапуск

Контейнер автоматически запускается при перезагрузке Synology благодаря настройке `restart: unless-stopped` в docker-compose.yml.

## Резервное копирование

Рекомендуется регулярно делать резервную копию директории данных:

```bash
# Создайте архив
tar -czf cinema-app-backup-$(date +%Y%m%d).tar.gz /volume1/docker/cinemadelux_5panel/data

# Или используйте встроенные инструменты Synology:
# - Hyper Backup для автоматического резервного копирования
# - Snapshot Replication для моментальных снимков
```
