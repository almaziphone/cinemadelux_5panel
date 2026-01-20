<template>
  <div class="board-container" ref="containerRef">
    <div class="board-content" :style="boardStyle">
      <!-- 5 мониторов с бордерами -->
      <div
        v-for="(monitor, index) in monitors"
        :key="index"
        class="monitor-frame"
      >
        <div class="monitor-content">
          <div class="films-showcase">
            <div
              v-for="film in monitor.films"
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
                
                <!-- Мета-информация: возраст, формат и цена -->
                <div class="film-meta">
                  <span class="meta-chip age">{{ film.ageRating }}</span>
                  <span v-if="film.format" class="meta-chip format">{{ film.format }}</span>
                  <span 
                    v-if="getNextShowtimePrice(film)" 
                    class="meta-chip price"
                    :class="{ 'price-blinking': hasUpcomingShowtime(film) }"
                  >
                    {{ getNextShowtimePrice(film) }}
                  </span>
                  <span 
                    v-else-if="getPriceRange(film)" 
                    class="meta-chip price"
                  >
                    {{ getPriceRange(film) }}
                  </span>
                </div>

                <!-- Времена сеансов чипами -->
                <div class="showtimes-chips">
                  <div
                    v-for="showtime in film.showtimes"
                    :key="showtime.id"
                    class="showtime-chip"
                    :class="{
                      'chip-active': isActive(showtime),
                      'chip-next': isNext(showtime, film.showtimes),
                      'chip-upcoming': isUpcoming(showtime)
                    }"
                  >
                    {{ getShowtimeDisplay(showtime, film.showtimes) }}
                  </div>
                  <div v-if="film.showtimes.length === 0" class="no-showtimes">
                    Нет сеансов
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  return boardData.value.films
})

// Распределение фильмов по 5 мониторам (по 4 карточки на монитор)
const monitors = computed(() => {
  const films = displayedFilms.value
  const monitorsCount = 5
  const filmsPerMonitor = 4
  const result = []
  
  for (let i = 0; i < monitorsCount; i++) {
    const startIndex = i * filmsPerMonitor
    const endIndex = startIndex + filmsPerMonitor
    result.push({
      films: films.slice(startIndex, endIndex)
    })
  }
  
  return result
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

function isUpcoming(showtime: BoardShowtime): boolean {
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  return showtimeStart > now
}

function getShowtimeDisplay(showtime: BoardShowtime, allShowtimes: BoardShowtime[]): string {
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  
  // Если сеанс уже прошел, не показываем его
  if (showtimeStart <= now) {
    return showtime.time
  }
  
  // Проверяем, есть ли сегодня еще сеансы после текущего времени
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const showtimeDate = new Date(showtimeStart.getFullYear(), showtimeStart.getMonth(), showtimeStart.getDate())
  
  // Если сеанс завтра
  if (showtimeDate.getTime() === tomorrow.getTime()) {
    // Проверяем, есть ли сегодня еще сеансы
    const todayShowtimes = allShowtimes.filter(s => {
      const sDate = new Date(s.startAt)
      const sDateOnly = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate())
      return sDateOnly.getTime() === today.getTime() && new Date(s.startAt) > now
    })
    
    // Если сегодняшних сеансов нет, показываем "завтра"
    if (todayShowtimes.length === 0) {
      return 'завтра'
    }
  }
  
  // Если сеанс не сегодня и не завтра, но в будущем
  if (showtimeDate.getTime() > today.getTime()) {
    const todayShowtimes = allShowtimes.filter(s => {
      const sDate = new Date(s.startAt)
      const sDateOnly = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate())
      return sDateOnly.getTime() === today.getTime() && new Date(s.startAt) > now
    })
    
    // Если сегодняшних сеансов нет, показываем "завтра"
    if (todayShowtimes.length === 0) {
      return 'завтра'
    }
  }
  
  return showtime.time
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

function getPriceRange(film: BoardFilm): string | null {
  const prices = film.showtimes
    .map(s => s.priceFrom)
    .filter((price): price is number => price !== null && price !== undefined)
  
  if (prices.length === 0) return null
  
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  
  if (minPrice === maxPrice) {
    return `${minPrice} руб.`
  } else {
    return `от ${minPrice} до ${maxPrice} руб.`
  }
}

function hasUpcomingShowtime(film: BoardFilm): boolean {
  const now = new Date()
  return film.showtimes.some(s => new Date(s.startAt) > now)
}

function getNextShowtimePrice(film: BoardFilm): string | null {
  const now = new Date()
  const futureShowtimes = film.showtimes
    .filter(s => new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (futureShowtimes.length === 0) return null
  
  const nextShowtime = futureShowtimes[0]
  
  if (nextShowtime.priceFrom === null || nextShowtime.priceFrom === undefined) {
    return null
  }
  
  return `${nextShowtime.priceFrom} руб.`
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
  flex-direction: row;
  height: 100%;
  width: 100%;
}

.monitor-frame {
  width: 1920px;
  height: 1080px;
  border: 12px solid #00d4ff;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 
    0 0 40px rgba(0, 212, 255, 0.8),
    0 0 80px rgba(0, 212, 255, 0.4),
    inset 0 0 30px rgba(0, 0, 0, 0.6),
    inset 0 0 60px rgba(0, 212, 255, 0.1);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 4px;
}

.monitor-frame::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  bottom: 4px;
  border: 2px solid rgba(255, 193, 7, 0.6);
  pointer-events: none;
  z-index: 1;
  border-radius: 2px;
}

.monitor-frame::after {
  content: '';
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
  z-index: 1;
  border-radius: 1px;
}

.monitor-content {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
  padding: 20px;
  box-sizing: border-box;
  position: relative;
  z-index: 0;
}

.films-showcase {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(2, auto);
  grid-auto-rows: 1fr;
  gap: 30px;
  padding: 40px;
  overflow: hidden;
  justify-content: start;
  align-items: stretch;
}

.film-card {
  width: 100%;
  max-width: 900px;
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

.meta-chip.price {
  background: rgba(76, 175, 80, 0.3);
  color: #4caf50;
  border: 2px solid #4caf50;
  font-weight: 700;
}

.meta-chip.price.price-blinking {
  animation: priceBlink 1.5s ease-in-out infinite;
  background: rgba(255, 193, 7, 0.4);
  color: #ffc107;
  border: 2px solid #ffc107;
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.6);
}

@keyframes priceBlink {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
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

.showtime-chip.chip-upcoming {
  animation: showtimeBlink 1.5s ease-in-out infinite;
  background: rgba(255, 193, 7, 0.4);
  border-color: #ffc107;
  color: #ffc107;
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.6);
  font-weight: bold;
}

@keyframes showtimeBlink {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.no-showtimes {
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  font-style: italic;
  padding: 12px;
  text-align: center;
}
</style>