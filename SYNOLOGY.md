# Развертывание на Synology Rackstation

## Подготовка

### 0. Установка Git на Synology (опционально)

Если хотите использовать git для клонирования проекта:

```bash
# Войдите как root или используйте sudo
sudo su

# Обновите пакеты
synopkg update

# Установите Git через ipkg (если доступен)
# Или через Центр пакетов установите "Git Server"
```

**Альтернатива:** Используйте File Station или SCP для загрузки файлов (см. ниже)

### 1. Установка Docker на Synology

1. Откройте **Центр пакетов** (Package Center)
2. Найдите и установите **Docker**
3. После установки откройте приложение **Docker**

### 2. Подготовка файлов на Synology

#### Вариант A: Через File Station (веб-интерфейс)

1. Откройте **File Station**
2. Создайте папку для проекта, например: `/docker/cinema-app/`
3. Загрузите все файлы проекта в эту папку:
   - `backend/` (вся папка)
   - `frontend/` (вся папка)
   - `docker-compose.yml`
   - `.dockerignore`
   - `package.json` (корневой)

#### Вариант B: Через SSH (рекомендуется)

1. Включите SSH в **Панель управления → Терминал и SNMP → Включить службу SSH**
2. Подключитесь к Synology по SSH:
   ```bash
   ssh admin@<IP-адрес-Synology>
   ```
3. Создайте директорию для проекта:
   ```bash
   sudo mkdir -p /volume1/docker/cinema-app
   cd /volume1/docker/cinema-app
   ```
4. Загрузите файлы проекта одним из способов:

   **A. Через SCP (с локальной машины):**
   ```bash
   # На локальной машине (Windows PowerShell или Linux/Mac)
   scp -r backend frontend docker-compose.yml docker-compose.synology.yml .dockerignore admin@<IP-Synology>:/volume1/docker/cinema-app/
   ```

   **B. Через File Station:**
   - Откройте File Station в веб-интерфейсе
   - Перейдите в `/docker/cinema-app/`
   - Загрузите все файлы через веб-интерфейс

   **C. Через WinSCP (Windows) или FileZilla:**
   - Подключитесь по SFTP к Synology
   - Перейдите в `/volume1/docker/cinema-app/`
   - Загрузите файлы

   **D. Установить Git (если нужно):**
   ```bash
   # Установите Git Server через Центр пакетов
   # Или используйте ipkg (если настроен)
   sudo ipkg install git
   ```

## Сборка образа

### Способ 1: Сборка на Synology через SSH (рекомендуется)

1. Подключитесь по SSH к Synology
2. Перейдите в директорию проекта:
   ```bash
   cd /volume1/cinemadelux_5panel
   # или
   cd /volume1/docker/cinema-app
   ```
3. Соберите образ (используйте `sudo` для прав доступа к Docker):
   ```bash
   sudo docker-compose build
   ```
   Или напрямую через Docker:
   ```bash
   sudo docker build -t cinema-app:latest -f backend/Dockerfile .
   ```
   
   **Важно:** На Synology обычно требуется `sudo` для работы с Docker, если пользователь не добавлен в группу `docker`.
   
   **Альтернатива:** Добавьте пользователя в группу docker (требуется root):
   ```bash
   sudo synogroup --add docker $USER
   # Затем перелогиньтесь
   ```

### Способ 2: Сборка на локальной машине и загрузка образа

1. На локальной машине соберите образ:
   ```bash
   docker build -t cinema-app:latest -f backend/Dockerfile .
   ```
2. Сохраните образ в файл:
   ```bash
   docker save cinema-app:latest | gzip > cinema-app.tar.gz
   ```
3. Загрузите файл на Synology (через File Station или SCP)
4. На Synology загрузите образ:
   ```bash
   docker load < cinema-app.tar.gz
   ```

### Способ 3: Через Container Manager (DSM 7.0+)

Если у вас установлен **Container Manager** (новый интерфейс Docker в DSM 7.0+):

1. Откройте **Container Manager**
2. Перейдите на вкладку **Образ**
3. Нажмите **Импорт** → выберите файл образа (если собрали на локальной машине)
4. Или используйте **Создать** → **Из Dockerfile** (если файлы уже на Synology)

## Запуск контейнера

### Способ 1: Через docker-compose (SSH)

1. Подключитесь по SSH
2. Перейдите в директорию проекта:
   ```bash
   cd /volume1/cinemadelux_5panel
   # или
   cd /volume1/docker/cinema-app
   ```
3. Запустите контейнер (используйте `sudo`):
   ```bash
   sudo docker-compose -f docker-compose.synology.yml up -d
   ```
   Или если используете обычный docker-compose.yml:
   ```bash
   sudo docker-compose up -d
   ```
4. Проверьте статус:
   ```bash
   sudo docker-compose ps
   sudo docker-compose logs -f
   ```

### Способ 2: Через веб-интерфейс Docker (DSM 6.x)

1. Откройте **Docker** в DSM
2. Перейдите на вкладку **Образ**
3. Найдите образ `cinema-app:latest`
4. Нажмите **Запустить**
5. Настройте контейнер:
   - **Имя контейнера**: `cinema-app`
   - **Автоматический перезапуск**: Включить
   - **Порты**:
     - Контейнер: `8080`
     - Локальный: `8080` (или другой свободный порт)
   - **Volumes** (тома):
     - Папка: `/volume1/docker/cinema-app/data`
     - Путь монтирования: `/app/data`
6. Нажмите **Применить** и **Запустить**

### Способ 3: Через Container Manager (DSM 7.0+)

1. Откройте **Container Manager**
2. Перейдите на вкладку **Контейнер**
3. Нажмите **Создать**
4. Выберите образ `cinema-app:latest`
5. Настройте:
   - **Имя контейнера**: `cinema-app`
   - **Автоматический перезапуск**: Включить
   - **Порты**: `8080:8080`
   - **Volumes**: Добавьте том
     - Папка: `/volume1/docker/cinema-app/data`
     - Путь: `/app/data`
6. Нажмите **Готово**

## Настройка docker-compose.yml для Synology

Если используете docker-compose, обновите пути в `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: cinema-app
    ports:
      - "8080:8080"
    volumes:
      # Используйте абсолютный путь для Synology
      - /volume1/docker/cinema-app/data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/api/board', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Создание директории для данных

Перед запуском создайте директорию для данных:

```bash
mkdir -p /volume1/docker/cinema-app/data/videos
chmod -R 755 /volume1/docker/cinema-app/data
```

## Доступ к приложению

После запуска контейнера приложение будет доступно по адресу:

- **Внутри сети Synology**: `http://<IP-адрес-Synology>:8080`
- **Табло**: `http://<IP-адрес-Synology>:8080/board`
- **Админка**: `http://<IP-адрес-Synology>:8080/admin`

## Управление контейнером

### Через SSH

```bash
# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Обновление (после изменений в коде)
docker-compose build --no-cache
docker-compose up -d --force-recreate
```

### Через веб-интерфейс

- **Docker** (DSM 6.x): Вкладка **Контейнер** → выберите контейнер → действия
- **Container Manager** (DSM 7.0+): Вкладка **Контейнер** → выберите контейнер → действия

## Автозапуск при перезагрузке Synology

Контейнер должен автоматически запускаться при перезагрузке, если:
- В docker-compose.yml указано `restart: unless-stopped`
- Или в веб-интерфейсе включен **Автоматический перезапуск**

## Резервное копирование

Рекомендуется регулярно делать резервную копию директории данных:

```bash
# Резервная копия базы данных и видео
tar -czf cinema-app-backup-$(date +%Y%m%d).tar.gz /volume1/docker/cinema-app/data
```

Или используйте встроенные инструменты Synology:
- **Hyper Backup** для автоматического резервного копирования
- **Snapshot Replication** для моментальных снимков

## Решение проблем

### Ошибка Permission denied при работе с Docker

Если получаете ошибку `PermissionError: [Errno 13] Permission denied`:

**Решение 1: Используйте sudo (самый простой способ)**
```bash
sudo docker-compose build
sudo docker-compose up -d
```

**Решение 2: Добавьте пользователя в группу docker**
```bash
# Войдите как root или используйте sudo
sudo synogroup --add docker $USER

# Затем перелогиньтесь (выйдите и войдите снова по SSH)
exit
# И снова подключитесь
ssh admin@<IP-Synology>
```

**Решение 3: Используйте root пользователя (не рекомендуется для безопасности)**
```bash
sudo su
docker-compose build
docker-compose up -d
```

### Порт занят

Если порт 8080 занят, измените в docker-compose.yml:
```yaml
ports:
  - "8081:8080"  # Используйте другой порт
```

### Проблемы с правами доступа

```bash
# Установите правильные права
sudo chown -R 1026:100 /volume1/docker/cinema-app/data
sudo chmod -R 755 /volume1/docker/cinema-app/data
```

### Просмотр логов для отладки

```bash
# Логи контейнера
sudo docker logs cinema-app

# Или через docker-compose
sudo docker-compose logs -f app
```

### Пересборка образа

```bash
cd /volume1/cinemadelux_5panel
# или
cd /volume1/docker/cinema-app

sudo docker-compose -f docker-compose.synology.yml build --no-cache
sudo docker-compose -f docker-compose.synology.yml up -d --force-recreate
```

## Оптимизация для Synology

### Использование SSD кэша

Если у вас есть SSD кэш на Synology, разместите директорию проекта на томе с SSD кэшем для лучшей производительности.

### Ограничение ресурсов

В веб-интерфейсе Docker можно ограничить использование CPU и памяти контейнером, если нужно.
