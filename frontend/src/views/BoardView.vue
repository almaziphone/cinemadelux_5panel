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
          <!-- Если пятый монитор пустой, показываем дату и время -->
          <div v-if="index === 4 && monitor.films.length === 0" class="datetime-display">
            <div class="datetime-content">
              <div class="date-display">{{ currentDate }}</div>
              <div class="time-display">{{ currentTime }}</div>
            </div>
          </div>
          <!-- Если четвертый монитор пустой, показываем календарь премьер -->
          <div v-else-if="index === 3 && monitor.films.length === 0 && premieres.length > 0" class="premieres-display">
            <div class="premieres-content">
              <h2 class="premieres-title">СКОРО В КИНО</h2>
              <div class="premieres-video-container">
                  <video
                    v-if="currentPremierVideoUrl"
                    ref="premierVideoRef"
                    :src="currentPremierVideoUrl"
                    class="premier-video"
                    @ended="handleVideoEnded"
                    @loadeddata="handleVideoLoaded"
                    @error="handleVideoError"
                    @canplay="handleVideoCanPlay"
                    muted
                    playsinline
                  ></video>
              </div>
            </div>
          </div>
          <!-- Обычное отображение фильмов -->
          <div v-else class="films-showcase">
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
                  <div class="film-meta-row">
                    <span class="meta-chip age">{{ film.ageRating }}</span>
                    <span v-if="film.format" class="meta-chip format">{{ film.format }}</span>
                    <template v-if="!hasFutureShowtimes(film)">
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
                    </template>
                  </div>
                  <div 
                    v-if="getNoShowtimesMessage(film) === 'завтра'" 
                    class="future-text"
                  >
                    Завтра
                  </div>
                </div>

                <!-- Времена сеансов чипами -->
                <div class="showtimes-chips" v-if="getNoShowtimesMessage(film) !== 'завтра'">
                  <div
                    v-for="showtime in getActiveShowtimes(film.showtimes)"
                    :key="showtime.id"
                    class="showtime-chip"
                    :class="getShowtimeClass(showtime, film.showtimes)"
                  >
                    {{ getShowtimeDisplay(showtime, film.showtimes) }}
                  </div>
                  <div v-if="getActiveShowtimes(film.showtimes).length === 0" class="no-showtimes">
                    {{ getNoShowtimesMessage(film) }}
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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { getBoard, getPremieres, type BoardResponse, type BoardFilm, type BoardShowtime, type Premier } from '../api/board'

const containerRef = ref<HTMLElement>()
// Получаем текущую дату в часовом поясе Екатеринбурга
function getCurrentDateInYekaterinburg(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Yekaterinburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

const boardData = ref<BoardResponse>({
  date: getCurrentDateInYekaterinburg(),
  films: []
})

const currentTime = ref('')
const currentDate = ref('')

// Премьеры
const premieres = ref<Premier[]>([])
const currentPremierIndex = ref(0)
const premierVideoRef = ref<HTMLVideoElement | null>(null)

// Вычисляемое свойство для текущего URL видео
const currentPremierVideoUrl = computed(() => {
  if (premieres.value.length === 0) return ''
  const index = currentPremierIndex.value
  if (index < 0 || index >= premieres.value.length) return ''
  const premier = premieres.value[index]
  return premier?.videoUrl || ''
})

let updateInterval: number | null = null
let timeInterval: number | null = null
let premieresInterval: number | null = null

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

// Вычисляем ближайший сеанс один раз для всех фильмов
// Используем currentTime для реактивности - будет пересчитываться каждую секунду
const nearestShowtimeTime = computed(() => {
  // Используем currentTime для реактивности обновления
  const _ = currentTime.value
  
  // Проверяем, что данные загружены
  if (!boardData.value || !boardData.value.films || boardData.value.films.length === 0) {
    return null
  }
  
  const now = new Date()
  const allFutureShowtimes = boardData.value.films
    .flatMap(f => f.showtimes || [])
    .filter(s => {
      if (!s || s.isHidden) return false
      const sStart = new Date(s.startAt)
      const sEnd = new Date(s.endAt)
      // Сеанс должен быть в будущем и еще не закончиться
      return sStart > now && sEnd > now
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (allFutureShowtimes.length === 0) return null
  
  // Возвращаем время ближайшего сеанса
  const nearestTime = new Date(allFutureShowtimes[0].startAt).getTime()
  return nearestTime
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
    hour12: false,
    timeZone: 'Asia/Yekaterinburg'
  })
  currentDate.value = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Yekaterinburg'
  })
}

function isActive(showtime: BoardShowtime): boolean {
  // Игнорируем скрытые сеансы
  if (showtime.isHidden) return false
  const now = new Date()
  // Конвертируем время сеанса в локальное время Екатеринбурга для сравнения
  const start = new Date(showtime.startAt)
  const end = new Date(showtime.endAt)
  return now >= start && now <= end
}

function getShowtimeClass(showtime: BoardShowtime, filmShowtimes: BoardShowtime[]): string {
  // Игнорируем скрытые сеансы
  if (showtime.isHidden) return ''
  
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  const showtimeEnd = new Date(showtime.endAt)
  
  // Идущие сеансы - серые
  if (now >= showtimeStart && now <= showtimeEnd) {
    return 'chip-active'
  }
  
  // Ближайший сеанс должен быть в будущем
  if (showtimeStart <= now) return ''
  
  // Находим ближайший предстоящий сеанс для этого конкретного фильма
  const futureShowtimes = filmShowtimes
    .filter(s => {
      if (s.isHidden) return false
      const sStart = new Date(s.startAt)
      const sEnd = new Date(s.endAt)
      return sStart > now && sEnd > now
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (futureShowtimes.length > 0) {
    const nearestFilmTime = new Date(futureShowtimes[0].startAt).getTime()
    const showtimeTime = showtimeStart.getTime()
    
    // Сравниваем время с точностью до минуты
    const showtimeMinutes = Math.floor(showtimeTime / 60000)
    const nearestMinutes = Math.floor(nearestFilmTime / 60000)
    
    // Если это ближайший сеанс этого фильма - оранжевый мигающий
    if (showtimeMinutes === nearestMinutes) {
      return 'chip-next'
    }
  }
  
  // Все остальные предстоящие - голубые
  return 'chip-upcoming'
}

function isNext(showtime: BoardShowtime, allShowtimes: BoardShowtime[]): boolean {
  // Игнорируем скрытые сеансы
  if (showtime.isHidden) return false
  
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  
  // Ближайший сеанс должен быть в будущем
  if (showtimeStart <= now) return false
  
  // Используем вычисленное ближайшее время
  const nearestTime = nearestShowtimeTime.value
  if (nearestTime === null) return false
  
  const showtimeTime = showtimeStart.getTime()
  
  // Проверяем, начинается ли этот сеанс в самое ближайшее время
  // (все сеансы, начинающиеся в одно и то же ближайшее время, должны быть оранжевыми)
  return showtimeTime === nearestTime
}

function isUpcoming(showtime: BoardShowtime): boolean {
  const now = new Date()
  const showtimeStart = new Date(showtime.startAt)
  
  // Игнорируем скрытые сеансы
  if (showtime.isHidden) return false
  
  // Если сеанс уже прошел или идет сейчас, не показываем как предстоящий
  if (showtimeStart <= now) return false
  
  // Используем вычисленное ближайшее время
  const nearestTime = nearestShowtimeTime.value
  if (nearestTime === null) return false
  
  // Если этот сеанс начинается в самое ближайшее время, не применяем класс upcoming (он будет chip-next)
  if (showtimeStart.getTime() === nearestTime) {
    return false
  }
  
  // Все остальные предстоящие сеансы - голубые
  return true
}

function getActiveShowtimes(showtimes: BoardShowtime[]): BoardShowtime[] {
  const now = new Date()
  return showtimes.filter(showtime => {
    // Игнорируем скрытые сеансы
    if (showtime.isHidden) return false
    const endAt = new Date(showtime.endAt)
    return endAt > now // Показываем только сеансы, которые еще не закончились
  })
}

// Получает дату в часовом поясе Екатеринбурга в формате YYYY-MM-DD
function getDateInYekaterinburg(date: Date): string {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Yekaterinburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

// Получает завтрашнюю дату в часовом поясе Екатеринбурга в формате YYYY-MM-DD
function getTomorrowDateInYekaterinburg(): string {
  const now = new Date()
  // Добавляем 24 часа для получения завтрашней даты
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return getDateInYekaterinburg(tomorrow)
}

// Общая функция для проверки наличия сеансов на завтра или позже
function hasShowtimesTomorrowOrLater(film: BoardFilm): boolean {
  // Получаем завтрашнюю дату в часовом поясе Екатеринбурга
  const tomorrowStr = getTomorrowDateInYekaterinburg()
  
  // Проверяем, есть ли сеансы завтра или позже (игнорируем скрытые)
  const futureShowtimes = film.showtimes.filter(showtime => {
    if (showtime.isHidden) return false
    // Получаем дату сеанса в часовом поясе Екатеринбурга
    const showtimeDate = new Date(showtime.startAt)
    const showtimeDateStr = getDateInYekaterinburg(showtimeDate)
    return showtimeDateStr >= tomorrowStr
  })
  
  return futureShowtimes.length > 0
}

function getNoShowtimesMessage(film: BoardFilm): string {
  // Проверяем все сеансы фильма (игнорируем скрытые)
  const visibleShowtimes = film.showtimes.filter(showtime => !showtime.isHidden)
  
  if (visibleShowtimes.length === 0) {
    return 'Нет сеансов'
  }
  
  // Используем общую функцию для проверки наличия сеансов на завтра
  if (hasShowtimesTomorrowOrLater(film)) {
    return 'завтра'
  }
  
  return 'Нет сеансов'
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
    // Проверяем, есть ли сегодня еще сеансы (игнорируем скрытые)
    const todayShowtimes = allShowtimes.filter(s => {
      if (s.isHidden) return false
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
      if (s.isHidden) return false
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
  return film.showtimes.some(s => !s.isHidden && isActive(s))
}

function hasNextShowtime(film: BoardFilm): boolean {
  const now = new Date()
  const futureShowtimes = film.showtimes
    .filter(s => !s.isHidden && new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (futureShowtimes.length === 0) return false
  
  const allFutureShowtimes = boardData.value.films
    .flatMap(f => f.showtimes)
    .filter(s => !s.isHidden && new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  return allFutureShowtimes.length > 0 && allFutureShowtimes[0].id === futureShowtimes[0].id
}

function getPriceRange(film: BoardFilm): string | null {
  const prices = film.showtimes
    .filter(s => !s.isHidden)
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
  
  // Находим самый ближайший сеанс среди всех фильмов (игнорируем скрытые)
  const allFutureShowtimes = boardData.value.films
    .flatMap(f => f.showtimes)
    .filter(s => !s.isHidden && new Date(s.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  
  if (allFutureShowtimes.length === 0) return false
  
  // Проверяем, есть ли у этого фильма самый ближайший сеанс
  const nextShowtime = allFutureShowtimes[0]
  return film.showtimes.some(s => !s.isHidden && s.id === nextShowtime.id)
}

function hasFutureShowtimes(film: BoardFilm): boolean {
  // Используем общую функцию для консистентности
  return hasShowtimesTomorrowOrLater(film)
}

function getNextShowtimePrice(film: BoardFilm): string | null {
  const now = new Date()
  const futureShowtimes = film.showtimes
    .filter(s => !s.isHidden && new Date(s.startAt) > now)
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

async function loadPremieres() {
  try {
    const newPremieres = await getPremieres()
    
    // Сортируем по sortOrder, затем по id (на случай одинакового sortOrder)
    newPremieres.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      return a.id - b.id
    })
    
    // Проверяем, изменился ли список премьер
    // 1. Изменилось количество
    const countChanged = premieres.value.length !== newPremieres.length
    
    // 2. Проверяем удаление - есть ли в новом списке все старые ID
    const hasDeleted = premieres.value.some(oldPremier => 
      !newPremieres.find(np => np.id === oldPremier.id)
    )
    
    // 3. Проверяем добавление - есть ли в новом списке новые ID
    const hasAdded = newPremieres.some(newPremier => 
      !premieres.value.find(op => op.id === newPremier.id)
    )
    
    // 4. Проверяем изменение существующих роликов или порядка
    const hasModified = premieres.value.some((oldPremier, oldIdx) => {
      const newIdx = newPremieres.findIndex(np => np.id === oldPremier.id)
      if (newIdx === -1) return false
      const newPremier = newPremieres[newIdx]
      return (
        oldPremier.videoUrl !== newPremier.videoUrl ||
        oldPremier.title !== newPremier.title ||
        oldPremier.sortOrder !== newPremier.sortOrder ||
        oldIdx !== newIdx // Изменился порядок
      )
    })
    
    const hasChanged = countChanged || hasDeleted || hasAdded || hasModified
    
    // Если список изменился, обновляем и перезапускаем
    if (hasChanged) {
      // Сохраняем информацию о текущем ролике до обновления
      const currentPremier = premieres.value[currentPremierIndex.value]
      const currentPremierId = currentPremier?.id
      
      // Обновляем список (уже отсортированный)
      premieres.value = newPremieres
      
      // Если список пуст, останавливаем воспроизведение
      if (premieres.value.length === 0) {
        const video = getVideoElement()
        if (video) {
          video.pause()
          video.currentTime = 0
        }
        currentPremierIndex.value = 0
        return
      }
      
      // Пытаемся найти текущий ролик в новом списке
      let newIndex = -1
      if (currentPremierId) {
        newIndex = newPremieres.findIndex(np => np.id === currentPremierId)
      }
      
      // Если текущий ролик был удален или не найден, начинаем с первого
      if (newIndex === -1) {
        const video = getVideoElement()
        if (video) {
          video.pause()
          video.currentTime = 0
        }
        currentPremierIndex.value = 0
      } else {
        // Если текущий ролик остался, сохраняем его новую позицию
        currentPremierIndex.value = newIndex
      }
      
      await nextTick()
      // Даем время на рендеринг video элемента
      setTimeout(() => {
        startPremierPlayback()
      }, 500)
    } else if (premieres.value.length === 0 && newPremieres.length > 0) {
      // Если это первая загрузка и есть ролики
      premieres.value = newPremieres
      currentPremierIndex.value = 0
      await nextTick()
      setTimeout(() => {
        startPremierPlayback()
      }, 500)
    }
  } catch (error) {
    // Ошибка загрузки премьер
  }
}

function startPremierPlayback() {
  if (premieres.value.length === 0) return
  
  // Устанавливаем первый индекс
  currentPremierIndex.value = 0
  
  // Ждем немного для инициализации видео элемента и обновления DOM
  setTimeout(() => {
    // В Vue 3 ref может быть массивом, если элемент еще не создан
    let video: HTMLVideoElement | null = null
    
    if (Array.isArray(premierVideoRef.value)) {
      video = premierVideoRef.value[0] as HTMLVideoElement
    } else if (premierVideoRef.value instanceof HTMLVideoElement) {
      video = premierVideoRef.value
    } else {
      // Пробуем найти элемент через DOM
      const videoElement = document.querySelector('.premier-video') as HTMLVideoElement
      if (videoElement) {
        video = videoElement
        premierVideoRef.value = video
      }
    }
    
    if (!video) {
      // Пробуем еще раз через задержку
      setTimeout(() => startPremierPlayback(), 500)
      return
    }
    
    if (typeof video.play !== 'function') {
      return
    }
    
    video.currentTime = 0
    video.play().catch(() => {
      // Ошибка воспроизведения
    })
  }, 500)
}

function getVideoElement(): HTMLVideoElement | null {
  // В Vue 3 ref может быть массивом
  if (Array.isArray(premierVideoRef.value)) {
    return premierVideoRef.value[0] as HTMLVideoElement || null
  } else if (premierVideoRef.value instanceof HTMLVideoElement) {
    return premierVideoRef.value
  } else {
    // Пробуем найти через DOM
    const videoElement = document.querySelector('.premier-video') as HTMLVideoElement
    if (videoElement) {
      premierVideoRef.value = videoElement
      return videoElement
    }
  }
  return null
}

function handleVideoEnded() {
  if (premieres.value.length === 0) return
  
  const video = getVideoElement()
  if (!video || typeof video.pause !== 'function') {
    return
  }
  
  // Останавливаем текущее видео
  video.pause()
  video.currentTime = 0
  
  // Вычисляем следующий индекс (циклическое переключение)
  const nextIdx = (currentPremierIndex.value + 1) % premieres.value.length
  
  // Обновляем индекс - это автоматически изменит src через computed
  currentPremierIndex.value = nextIdx
  
  // Ждем обновления src и запускаем следующее видео
  setTimeout(() => {
    const nextVideo = getVideoElement()
    if (!nextVideo) {
      // Если видео элемент не найден, пробуем еще раз
      setTimeout(() => handleVideoEnded(), 300)
      return
    }
    
    if (typeof nextVideo.play !== 'function') {
      return
    }
    
    // Сбрасываем время и загружаем новое видео
    nextVideo.currentTime = 0
    nextVideo.load() // Принудительно загружаем новое видео
    
    // Пробуем запустить воспроизведение
    const playPromise = nextVideo.play()
    if (playPromise) {
      playPromise
        .then(() => {
          // Видео успешно запущено
        })
        .catch(() => {
          // Если не удалось запустить, пробуем еще раз
          setTimeout(() => {
            nextVideo.play().catch(() => {
              // Если и повторная попытка не удалась, пробуем переключиться на следующее
              setTimeout(() => handleVideoEnded(), 500)
            })
          }, 300)
        })
    }
  }, 200)
}

function handleVideoLoaded() {
  // Видео загружено
}

function handleVideoCanPlay() {
  const video = getVideoElement()
  if (video) {
    // Если это первое видео и оно готово, запускаем его
    if (currentPremierIndex.value === 0 && video.paused) {
      video.play().catch(() => {})
    }
  }
}

function handleVideoError() {
  // Ошибка загрузки видео
}

onMounted(() => {
  updateTime()
  loadBoard()
  loadPremieres()
  
  timeInterval = window.setInterval(updateTime, 1000)
  updateInterval = window.setInterval(loadBoard, 30000)
  // Обновляем премьеры каждые 30 секунд
  premieresInterval = window.setInterval(loadPremieres, 30000)
})

onUnmounted(() => {
  if (updateInterval !== null) {
    clearInterval(updateInterval)
  }
  if (timeInterval !== null) {
    clearInterval(timeInterval)
  }
  if (premieresInterval !== null) {
    clearInterval(premieresInterval)
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
  flex-direction: column;
  gap: 20px;
  margin: 0 0 30px 0;
}

.film-meta-row {
  display: flex;
  flex-direction: row;
  gap: 15px;
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

.future-text {
  color: #00d4ff;
  font-size: 72px;
  font-weight: 700;
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.8);
  letter-spacing: 2px;
  margin-top: 10px;
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
  background: rgba(128, 128, 128, 0.3);
  border-color: #808080;
  color: #c0c0c0;
  box-shadow: 0 0 15px rgba(128, 128, 128, 0.4);
  font-weight: bold;
}

.showtime-chip.chip-next {
  animation: showtimeBlink 1.5s ease-in-out infinite !important;
  background: rgba(255, 193, 7, 0.4) !important;
  border-color: #ffc107 !important;
  color: #ffc107 !important;
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.6) !important;
  font-weight: bold;
}

.showtime-chip.chip-upcoming {
  background: rgba(0, 212, 255, 0.3);
  border-color: #00d4ff;
  color: #00d4ff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
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

/* Отображение даты и времени на пустом пятом мониторе */
.datetime-display {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
}

.datetime-content {
  text-align: center;
  color: #fff;
}

.date-display {
  font-size: 120px;
  font-weight: 700;
  color: #00d4ff;
  text-shadow: 
    0 0 20px rgba(0, 212, 255, 0.8),
    0 0 40px rgba(0, 212, 255, 0.6),
    0 0 60px rgba(0, 212, 255, 0.4);
  margin-bottom: 60px;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.time-display {
  font-size: 180px;
  font-weight: 900;
  color: #ffc107;
  text-shadow: 
    0 0 30px rgba(255, 193, 7, 0.9),
    0 0 60px rgba(255, 193, 7, 0.7),
    0 0 90px rgba(255, 193, 7, 0.5);
  letter-spacing: 8px;
  font-family: 'Courier New', monospace;
  animation: timePulse 2s ease-in-out infinite;
}

@keyframes timePulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.02);
  }
}

/* Календарь премьер */
.premieres-display {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
}

.premieres-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  box-sizing: border-box;
}

.premieres-title {
  font-size: 96px;
  font-weight: 900;
  color: #00d4ff;
  text-shadow: 
    0 0 30px rgba(0, 212, 255, 0.9),
    0 0 60px rgba(0, 212, 255, 0.7),
    0 0 90px rgba(0, 212, 255, 0.5);
  letter-spacing: 8px;
  margin-bottom: 40px;
  text-transform: uppercase;
  animation: titlePulse 3s ease-in-out infinite;
  position: relative;
  z-index: 2;
}

@keyframes titlePulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.premieres-video-container {
  width: 100%;
  height: calc(100% - 200px);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.premier-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

.premier-video.active {
  opacity: 1;
  z-index: 1;
}
</style>