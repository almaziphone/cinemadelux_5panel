#!/bin/bash
# Скрипт для развертывания на Synology Rackstation

set -e

echo "=== Развертывание Cinema App на Synology ==="

# Определяем путь к проекту (по умолчанию /volume1/docker/cinema-app)
PROJECT_DIR="${1:-/volume1/docker/cinema-app}"
DATA_DIR="$PROJECT_DIR/data"

echo "Директория проекта: $PROJECT_DIR"
echo "Директория данных: $DATA_DIR"

# Создаем директории
echo "Создание директорий..."
mkdir -p "$DATA_DIR/videos"
chmod -R 755 "$DATA_DIR"

# Переходим в директорию проекта
cd "$PROJECT_DIR"

# Проверяем наличие docker-compose
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "Ошибка: docker-compose не найден. Установите Docker на Synology."
    exit 1
fi

# Проверяем права доступа к Docker
if ! sudo docker info &> /dev/null; then
    echo "Предупреждение: Требуются права sudo для работы с Docker."
    echo "Используйте: sudo $0"
    exit 1
fi

# Собираем образ
echo "Сборка Docker образа..."
sudo docker-compose -f docker-compose.synology.yml build

# Останавливаем существующий контейнер (если есть)
echo "Остановка существующего контейнера (если есть)..."
sudo docker-compose -f docker-compose.synology.yml down || true

# Запускаем контейнер
echo "Запуск контейнера..."
sudo docker-compose -f docker-compose.synology.yml up -d

# Ждем немного для запуска
sleep 5

# Проверяем статус
echo "Проверка статуса контейнера..."
sudo docker-compose -f docker-compose.synology.yml ps

echo ""
echo "=== Развертывание завершено! ==="
echo "Приложение доступно по адресу: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Полезные команды (не забудьте sudo):"
echo "  Просмотр логов: sudo docker-compose -f docker-compose.synology.yml logs -f"
echo "  Остановка: sudo docker-compose -f docker-compose.synology.yml down"
echo "  Перезапуск: sudo docker-compose -f docker-compose.synology.yml restart"
