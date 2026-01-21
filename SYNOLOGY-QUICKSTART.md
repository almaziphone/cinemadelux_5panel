# Быстрый старт на Synology

## Самый простой способ (через SSH)

1. **Подключитесь к Synology по SSH:**
   ```bash
   ssh admin@<IP-адрес-Synology>
   ```

2. **Создайте директорию и загрузите файлы:**
   ```bash
   sudo mkdir -p /volume1/docker/cinema-app
   cd /volume1/docker/cinema-app
   ```
   
   Затем загрузите все файлы проекта (через File Station, SCP, или git clone)

3. **Создайте директорию для данных:**
   ```bash
   mkdir -p data/videos
   chmod -R 755 data
   ```

4. **Соберите и запустите (используйте sudo для прав доступа):**
   ```bash
   # Используйте специальный файл для Synology
   sudo docker-compose -f docker-compose.synology.yml build
   sudo docker-compose -f docker-compose.synology.yml up -d
   ```

5. **Проверьте статус:**
   ```bash
   sudo docker-compose -f docker-compose.synology.yml ps
   sudo docker-compose -f docker-compose.synology.yml logs -f
   ```
   
   **Примечание:** Если получаете ошибку Permission denied, всегда используйте `sudo` перед командами docker/docker-compose.

6. **Откройте в браузере:**
   - Табло: `http://<IP-адрес-Synology>:8080/board`
   - Админка: `http://<IP-адрес-Synology>:8080/admin`

## Или используйте скрипт автоматического развертывания

1. Загрузите файл `deploy-synology.sh` на Synology
2. Сделайте его исполняемым:
   ```bash
   chmod +x deploy-synology.sh
   ```
3. Запустите:
   ```bash
   ./deploy-synology.sh
   ```

## Через веб-интерфейс Docker (без SSH)

1. **Загрузите файлы через File Station:**
   - Создайте папку `/docker/cinema-app/`
   - Загрузите все файлы проекта

2. **Соберите образ на локальной машине:**
   ```bash
   docker build -t cinema-app:latest -f backend/Dockerfile .
   docker save cinema-app:latest | gzip > cinema-app.tar.gz
   ```

3. **Загрузите образ на Synology:**
   - Через File Station загрузите `cinema-app.tar.gz`
   - В Docker → Образ → Импорт → выберите файл

4. **Создайте контейнер:**
   - Docker → Контейнер → Создать
   - Выберите образ `cinema-app:latest`
   - Настройте:
     - Имя: `cinema-app`
     - Порты: `8080:8080`
     - Volumes: `/volume1/docker/cinema-app/data` → `/app/data`
     - Автоперезапуск: Включить

5. **Запустите контейнер**

## Важные замечания

- Замените `/volume1` на ваш том, если используете другой (например, `/volume2`)
- Убедитесь, что порт 8080 свободен, или измените его в `docker-compose.synology.yml`
- Для доступа извне настройте порт в **Панель управления → Маршрутизация** (если нужно)
