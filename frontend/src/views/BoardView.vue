<template>
  <div class="board-container" ref="containerRef">
    <div class="board-content" :style="boardStyle">
      <!-- Шапка с часами и датой -->
      <header class="board-header">
        <div class="current-time">{{ currentTime }}</div>
        <div class="current-date">{{ currentDate }}</div>
      </header>

      <!-- Карточки фильмов -->
      <main class="films-container">
        <div
          v-for="film in boardData.films"
          :key="film.id"
          class="film-card"
          :class="{
            'film-active': hasActiveShowtime(film),
            'film-next': hasNextShowtime(film)
          }"
        >
          <!-- Постер фильма -->
          <div class="film-poster">
            <img
              v-if="film.posterUrl"
              :src="film.posterUrl"
              :alt="film.title"
              class="poster-image"
            />
            <div v-else class="poster-placeholder">
              <div class="poster-icon">🎬</div>
            </div>
          </div>

          <!-- Информация о фильме -->
          <div class="film-info">
            <h2 class="film-title">{{ film.title }}</h2>
            
            <div class="film-meta">
              <span v-if="film.format" class="meta-badge format">{{ film.format }}</span>
              <span class="meta-badge age">{{ film.ageRating }}</span>
              <span class="meta-badge duration">{{ film.durationMin }} мин</span>
            </div>

            <p v-if="film.description" class="film-description">{{ film.description }}</p>

            <!-- Расписание сеансов -->
            <div class="showtimes-section">
              <h3 class="showtimes-title">Расписание сеансов:</h3>
              <div class="showtimes-grid">
                <div
                  v-for="showtime in film.showtimes"
                  :key="showtime.id"
                  class="showtime-badge"
                  :class="{
                    'showtime-active': isActive(showtime),
                    'showtime-next': isNext(showtime, film.showtimes)
                  }"
                >
                  <div class="showtime-time">{{ showtime.time }}</div>
                  <div class="showtime-hall">{{ showtime.hallName }}</div>
                  <div v-if="showtime.priceFrom" class="showtime-price">
                    {{ showtime.priceFrom }} ₽
                  </div>
                  <div v-if="showtime.note" class="showtime-note">{{ showtime.note }}</div>
                </div>
              </div>
              <div v-if="film.showtimes.length === 0" class="no-showtimes">
                Нет сеансов на сегодня
              </div>
            </div>
          </div>
        </div>

        <!-- Сообщение, если нет фильмов -->
        <div v-if="boardData.films.length === 0" class="no-films">
          <div class="no-films-icon">🎭</div>
          <div class="no-films-text">На сегодня нет сеансов</div>
        </div>
      </main>

      <!-- Нижняя строка (ticker) -->
      <footer class="board-footer">
        <div class="ticker">{{ tickerText }}</div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getBoard, type BoardResponse, type BoardFilm, type BoardShowtime } from '../api/board'

const containerRef = ref<HTMLElement>()
const boardData = ref<BoardResponse>({
  date: new Date().toISOString().split('T')[0],
  films: []
})

const currentTime = ref('')
const currentDate = ref('')
const tickerText = 'Добро пожаловать в кинотеатр! Приятного просмотра!'

let updateInterval: number | null = null
let timeInterval: number | null = null

const boardStyle = computed(() => {
  if (!containerRef.value) return {}
  
  const container = containerRef.value
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  
  const targetWidth = 9600
  const targetHeight = 1080
  
  const scaleX = containerWidth / targetWidth
  const scaleY = containerHeight / targetHeight
  const scale = Math.min(scaleX, scaleY)
  
  return {
    width: `${targetWidth}px`,
    height: `${targetHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left'
  }
})

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  currentDate.value = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function isActive(showtime: BoardShowtime): boolean {
  const now = new Date()
  const start = new Date(showtime.startAt)
  const end = new Date(showtime.endAt)
  return now >= start && now <= end
}

function isNext(showtime: BoardShowtime, allShowtimes: BoardShowtime[]): boolean {
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  
  if (showtimeStart <= now) return false
  
  // Проверяем, что это ближайший следующий сеанс
  const futureShowtimes = allShowtimes
    .filter(s => new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  return futureShowtimes.length > 0 && futureShowtimes[0].id === showtime.id
}

function hasActiveShowtime(film: BoardFilm): boolean {
  return film.showtimes.some(s => isActive(s))
}

function hasNextShowtime(film: BoardFilm): boolean {
  const now = new Date()
  const futureShowtimes = film.showtimes
    .filter(s => new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (futureShowtimes.length === 0) return false
  
  // Проверяем, что это ближайший следующий фильм среди всех
  const allFutureShowtimes = boardData.value.films
    .flatMap(f => f.showtimes)
    .filter(s => new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  return allFutureShowtimes.length > 0 && allFutureShowtimes[0].id === futureShowtimes[0].id
}

async function loadBoard() {
  try {
    const data = await getBoard()
    boardData.value = data
  } catch (error) {
    console.error('Failed to load board:', error)
  }
}

onMounted(() => {
  updateTime()
  loadBoard()
  
  // Обновление времени каждую секунду
  timeInterval = window.setInterval(updateTime, 1000)
  
  // Обновление данных табло каждые 30 секунд
  updateInterval = window.setInterval(loadBoard, 30000)
})

onUnmounted(() => {
  if (updateInterval !== null) {
    clearInterval(updateInterval)
  }
  if (timeInterval !== null) {
    clearInterval(timeInterval)
  }
})
</script>

<style scoped>
.board-container {
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
  position: relative;
}

.board-content {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
}

.board-header {
  padding: 40px 80px;
  text-align: center;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 4px solid #00d4ff;
  flex-shrink: 0;
}

.current-time {
  font-size: 100px;
  font-weight: bold;
  color: #00d4ff;
  text-shadow: 0 0 30px rgba(0, 212, 255, 0.6);
  margin-bottom: 16px;
  font-family: 'Courier New', monospace;
}

.current-date {
  font-size: 42px;
  color: #fff;
  text-transform: capitalize;
}

.films-container {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 50px;
  padding: 50px 80px;
  overflow-y: auto;
  align-content: start;
}

.film-card {
  background: rgba(255, 255, 255, 0.08);
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  min-height: 800px;
}

.film-card:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-5px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.film-card.film-active {
  background: rgba(0, 212, 255, 0.15);
  border-color: #00d4ff;
  box-shadow: 0 0 50px rgba(0, 212, 255, 0.4);
}

.film-card.film-next {
  background: rgba(255, 193, 7, 0.12);
  border-color: #ffc107;
  box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
}

.film-poster {
  width: 100%;
  height: 500px;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%);
}

.poster-icon {
  font-size: 120px;
  opacity: 0.5;
}

.film-info {
  padding: 40px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.film-title {
  font-size: 56px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 24px;
  line-height: 1.2;
}

.film-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.meta-badge {
  font-size: 28px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
}

.meta-badge.format {
  background: rgba(0, 212, 255, 0.3);
  color: #00d4ff;
  border: 2px solid #00d4ff;
}

.meta-badge.age {
  background: rgba(255, 193, 7, 0.3);
  color: #ffc107;
  border: 2px solid #ffc107;
}

.meta-badge.duration {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.film-description {
  font-size: 28px;
  color: #ccc;
  line-height: 1.5;
  margin-bottom: 32px;
  flex: 1;
}

.showtimes-section {
  margin-top: auto;
}

.showtimes-title {
  font-size: 36px;
  color: #00d4ff;
  margin-bottom: 20px;
  font-weight: 600;
}

.showtimes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.showtime-badge {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.showtime-badge:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.showtime-badge.showtime-active {
  background: rgba(0, 212, 255, 0.25);
  border-color: #00d4ff;
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

.showtime-badge.showtime-next {
  background: rgba(255, 193, 7, 0.2);
  border-color: #ffc107;
  box-shadow: 0 0 15px rgba(255, 193, 7, 0.3);
}

.showtime-time {
  font-size: 42px;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
}

.showtime-hall {
  font-size: 24px;
  color: #fff;
  margin-bottom: 8px;
}

.showtime-price {
  font-size: 28px;
  color: #4caf50;
  font-weight: 600;
  margin-top: 8px;
}

.showtime-note {
  font-size: 20px;
  color: #aaa;
  margin-top: 8px;
  font-style: italic;
}

.no-showtimes {
  text-align: center;
  padding: 40px;
  font-size: 28px;
  color: #666;
}

.no-films {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px;
  text-align: center;
}

.no-films-icon {
  font-size: 120px;
  margin-bottom: 30px;
  opacity: 0.5;
}

.no-films-text {
  font-size: 48px;
  color: #666;
}

.board-footer {
  padding: 30px 80px;
  background: rgba(0, 0, 0, 0.5);
  border-top: 2px solid #00d4ff;
  overflow: hidden;
  flex-shrink: 0;
}

.ticker {
  font-size: 36px;
  color: #00d4ff;
  white-space: nowrap;
  animation: ticker-scroll 30s linear infinite;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

@keyframes ticker-scroll {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}
</style>
