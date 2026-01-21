#!/bin/bash

# Скрипт автоматического обновления приложения на Synology NAS
# Использование: sudo ./update-synology.sh

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Путь к проекту (измените если нужно)
PROJECT_DIR="/volume1/docker/cinemadelux_5panel"
COMPOSE_FILE="docker-compose.synology.yml"

echo -e "${GREEN}=== Обновление Cinema Delux ===${NC}"
echo ""

# Проверка, что скрипт запущен с sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Скрипт должен быть запущен с sudo${NC}"
    echo "Использование: sudo ./update-synology.sh"
    exit 1
fi

# Переход в директорию проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Ошибка: Директория проекта не найдена: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${GREEN}Текущая директория: $(pwd)${NC}"
echo ""

# Шаг 1: Обновление кода из Git
echo -e "${YELLOW}[1/4] Обновление кода из Git...${NC}"
if git pull; then
    echo -e "${GREEN}✓ Код успешно обновлен${NC}"
else
    echo -e "${RED}✗ Ошибка при обновлении кода${NC}"
    exit 1
fi
echo ""

# Шаг 2: Пересборка Docker образов
echo -e "${YELLOW}[2/4] Пересборка Docker образов...${NC}"
if docker-compose -f "$COMPOSE_FILE" build; then
    echo -e "${GREEN}✓ Образы успешно пересобраны${NC}"
else
    echo -e "${RED}✗ Ошибка при пересборке образов${NC}"
    exit 1
fi
echo ""

# Шаг 3: Перезапуск контейнеров
echo -e "${YELLOW}[3/4] Перезапуск контейнеров...${NC}"
if docker-compose -f "$COMPOSE_FILE" up -d --force-recreate; then
    echo -e "${GREEN}✓ Контейнеры успешно перезапущены${NC}"
else
    echo -e "${RED}✗ Ошибка при перезапуске контейнеров${NC}"
    exit 1
fi
echo ""

# Шаг 4: Проверка статуса
echo -e "${YELLOW}[4/4] Проверка статуса контейнеров...${NC}"
sleep 3  # Даем контейнерам время на запуск
docker-compose -f "$COMPOSE_FILE" ps
echo ""

# Показываем последние логи
echo -e "${YELLOW}Последние логи контейнера:${NC}"
docker-compose -f "$COMPOSE_FILE" logs --tail=20
echo ""

echo -e "${GREEN}=== Обновление завершено успешно! ===${NC}"
echo ""
echo "Приложение доступно по адресу:"
echo "  - Табло: http://$(hostname -I | awk '{print $1}'):8080/board"
echo "  - Админка: http://$(hostname -I | awk '{print $1}'):8080/admin"
