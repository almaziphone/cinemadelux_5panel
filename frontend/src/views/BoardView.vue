<template>
  <div class="board-container" ref="containerRef">
    <div class="board-content" :style="boardStyle">
      <!-- Шапка с часами и датой -->
      <header class="board-header">
        <div class="current-time">{{ currentTime }}</div>
        <div class="current-date">{{ currentDate }}</div>
      </header>

      <!-- Витрина фильмов -->
      <main class="films-showcase">
        <div
          v-for="film in displayedFilms"
          :key="film.id"
          class="film-card"
          :class="{
            'film-active': hasActiveShowtime(film),
            'film-next': hasNextShowtime(film)
          }"
        >
          <!-- Постер фильма слева -->
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

          <!-- Информация справа -->
          <div class="film-info">
            <!-- Название фильма -->
            <h2 class="film-title">{{ film.title.toUpperCase() }}</h2>
            
            <!-- Мета-информация: возраст и формат -->
            <div class="film-meta">
              <span class="meta-chip age">{{ film.ageRating }}</span>
              <span v-if="film.format" class="meta-chip format">{{ film.format }}</span>
            </div>

            <!-- Времена сеансов чипами -->
            <div class="showtimes-chips">
              <div
                v-for="showtime in film.showtimes"
                :key="showtime.id"
                class="showtime-chip"
                :class="{
                  'chip-active': isActive(showtime),
                  'chip-next': isNext(showtime, film.showtimes)
                }"
              >
                {{ showtime.time }}
              </div>
              <div v-if="film.showtimes.length === 0" class="no-showtimes">
                Нет сеансов
              </div>
            </div>
          </div>
        </div>
      </main>
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

let updateInterval: number | null = null
let timeInterval: number | null = null

const displayedFilms = computed(() => {
  return boardData.value.films.slice(0, 12)
})

const boardStyle = computed(() => {
  return {
    width: '9600px',
    height: '1080px'
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
  
  timeInterval = window.setInterval(updateTime, 1000)
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
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.board-header {
  padding: 40px 80px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 3px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.current-time {
  font-size: 120px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20px;
  font-family: 'Courier New', monospace;
}

.current-date {
  font-size: 56px;
  color: rgba(255, 255, 255, 0.8);
  text-transform: capitalize;
}

.films-showcase {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: 1fr;
  gap: 30px;
  padding: 60px 40px;
  overflow: hidden;
  justify-content: start;
  align-items: stretch;
}

.film-card {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 0;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.film-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-5px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.film-card.film-active {
  background: rgba(0, 212, 255, 0.1);
  border-color: #00d4ff;
  box-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
}

.film-card.film-next {
  background: rgba(255, 193, 7, 0.1);
  border-color: #ffc107;
  box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
}

.film-poster {
  width: auto;
  height: 100%;
  flex: 0 0 auto;
  aspect-ratio: 2/3;
  background: rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poster-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
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
  font-size: 80px;
  opacity: 0.3;
}

.film-info {
  flex: 1;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.film-title {
  font-size: 48px;
  font-weight: bold;
  color: #fff;
  margin: 0 0 30px 0;
  line-height: 1.2;
  letter-spacing: 1px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.film-meta {
  display: flex;
  flex-direction: row;
  gap: 15px;
  margin: 0 0 30px 0;
  flex-wrap: wrap;
}

.meta-chip {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 600;
  display: inline-block;
  text-align: center;
}

.meta-chip.age {
  background: rgba(255, 193, 7, 0.3);
  color: #ffc107;
  border: 2px solid #ffc107;
}

.meta-chip.format {
  background: rgba(0, 212, 255, 0.3);
  color: #00d4ff;
  border: 2px solid #00d4ff;
}

.showtimes-chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
  margin-top: auto;
}

.showtime-chip {
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  transition: all 0.3s ease;
  cursor: pointer;
  text-align: center;
}

.showtime-chip:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.showtime-chip.chip-active {
  background: rgba(0, 212, 255, 0.3);
  border-color: #00d4ff;
  color: #00d4ff;
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
  font-weight: bold;
}

.showtime-chip.chip-next {
  background: rgba(255, 193, 7, 0.3);
  border-color: #ffc107;
  color: #ffc107;
  box-shadow: 0 0 15px rgba(255, 193, 7, 0.3);
  font-weight: bold;
}

.no-showtimes {
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  font-style: italic;
  padding: 12px;
  text-align: center;
}
</style>