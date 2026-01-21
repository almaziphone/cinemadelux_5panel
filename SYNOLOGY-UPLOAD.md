# Загрузка файлов на Synology (без Git)

## Способ 1: Через File Station (самый простой)

1. Откройте **File Station** в веб-интерфейсе Synology
2. Создайте папку `/docker/cinema-app/` (если её нет)
3. Загрузите все файлы проекта:
   - Перетащите папки `backend/` и `frontend/`
   - Перетащите файлы: `docker-compose.yml`, `docker-compose.synology.yml`, `.dockerignore`, `package.json`
4. Убедитесь, что структура выглядит так:
   ```
   /docker/cinema-app/
   ├── backend/
   ├── frontend/
   ├── docker-compose.yml
   ├── docker-compose.synology.yml
   ├── .dockerignore
   └── package.json
   ```

## Способ 2: Через SCP (из командной строки)

### На Windows (PowerShell):

```powershell
# Перейдите в директорию проекта
cd e:\ProgJava\cinemadelux_5panel

# Загрузите файлы на Synology
scp -r backend frontend docker-compose.yml docker-compose.synology.yml .dockerignore package.json admin@<IP-Synology>:/volume1/docker/cinema-app/
```

### На Linux/Mac:

```bash
# Перейдите в директорию проекта
cd /path/to/cinemadelux_5panel

# Загрузите файлы на Synology
scp -r backend frontend docker-compose.yml docker-compose.synology.yml .dockerignore package.json admin@<IP-Synology>:/volume1/docker/cinema-app/
```

## Способ 3: Через WinSCP (Windows) или FileZilla

1. **Установите WinSCP** (Windows) или **FileZilla** (Windows/Mac/Linux)
2. Подключитесь к Synology по SFTP:
   - Хост: `<IP-адрес-Synology>`
   - Порт: `22`
   - Протокол: `SFTP`
   - Пользователь: `admin` (или ваш пользователь)
   - Пароль: ваш пароль
3. Перейдите в `/volume1/docker/cinema-app/`
4. Загрузите все файлы проекта

## Способ 4: Создать архив и загрузить

### На локальной машине:

```bash
# Создайте архив проекта (исключая node_modules и dist)
tar -czf cinema-app.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='data' \
  backend frontend docker-compose*.yml .dockerignore package.json
```

### Загрузите архив на Synology:

1. Через File Station загрузите `cinema-app.tar.gz`
2. Через SSH распакуйте:
   ```bash
   cd /volume1/docker
   tar -xzf cinema-app.tar.gz -C cinema-app
   ```

## Способ 5: Установить Git на Synology

Если всё же хотите использовать git:

### Вариант A: Через Центр пакетов

1. Откройте **Центр пакетов**
2. Найдите и установите **Git Server**
3. После установки git будет доступен в терминале

### Вариант B: Через ipkg (если настроен)

```bash
sudo ipkg update
sudo ipkg install git
```

### Вариант C: Скомпилировать вручную (продвинутый)

```bash
# Установите необходимые инструменты
sudo ipkg install gcc make

# Скачайте и скомпилируйте Git
cd /tmp
wget https://github.com/git/git/archive/v2.42.0.tar.gz
tar -xzf v2.42.0.tar.gz
cd git-2.42.0
make configure
./configure --prefix=/usr/local
make
sudo make install
```

## Проверка загрузки

После загрузки файлов проверьте структуру:

```bash
cd /volume1/docker/cinema-app
ls -la
# Должны быть видны: backend, frontend, docker-compose.yml и т.д.

# Проверьте структуру backend
ls -la backend/
# Должны быть: src/, package.json, Dockerfile, tsconfig.json

# Проверьте структуру frontend
ls -la frontend/
# Должны быть: src/, package.json, vite.config.ts, index.html
```

## Создание директории для данных

После загрузки файлов создайте директорию для данных:

```bash
mkdir -p /volume1/docker/cinema-app/data/videos
chmod -R 755 /volume1/docker/cinema-app/data
```

## Рекомендация

Для первого раза **рекомендую использовать File Station** - это самый простой и надёжный способ. После этого можно использовать SSH для управления контейнером.
