<template>
  <div class="admin-container">
    <header class="admin-header">
      <h1>Админ-панель</h1>
      <div class="admin-actions">
        <span v-if="user">Привет, {{ user.username }}!</span>
        <button @click="handleLogout" class="logout-button">Выйти</button>
      </div>
    </header>

    <div class="admin-tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        @click="activeTab = tab"
        :class="['tab-button', { active: activeTab === tab }]"
      >
        {{ tabLabels[tab] }}
      </button>
    </div>

    <div class="admin-content">
      <!-- Фильмы -->
      <div v-if="activeTab === 'films'" class="tab-content">
        <div class="section-header">
          <h2>Фильмы</h2>
          <button @click="openFilmModal()" class="add-button">+ Добавить фильм</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Постер</th>
                <th>ID Кинопоиска</th>
                <th>Название</th>
                <th>Длительность</th>
                <th>Возраст</th>
                <th>Формат</th>
                <th>Активен</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="film in films" :key="film.id">
                <td class="poster-cell">
                  <div v-if="film.posterUrl" class="table-poster">
                    <img :src="film.posterUrl" :alt="film.title" @error="handleTablePosterError" />
                  </div>
                  <span v-else class="no-poster">—</span>
                </td>
                <td>{{ film.kinopoiskId || '-' }}</td>
                <td>{{ film.title }}</td>
                <td>{{ film.durationMin }} мин</td>
                <td>{{ film.ageRating }}</td>
                <td>{{ film.format || '-' }}</td>
                <td>{{ film.isActive ? 'Да' : 'Нет' }}</td>
                <td>
                  <button @click="openFilmModal(film)" class="edit-button">Редактировать</button>
                  <button @click="deleteFilmHandler(film.id!)" class="delete-button">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Сеансы -->
      <div v-if="activeTab === 'showtimes'" class="tab-content">
        <div class="section-header">
          <h2>Сеансы</h2>
          <div class="filters">
            <input
              v-model="showtimeFilters.date"
              type="date"
              class="filter-input"
            />
            <select v-model="showtimeFilters.hallId" class="filter-input">
              <option :value="undefined">Все залы</option>
              <option v-for="hall in halls" :key="hall.id" :value="hall.id">
                {{ hall.name }}
              </option>
            </select>
            <button @click="loadShowtimes" class="filter-button">Применить</button>
          </div>
          <button @click="openShowtimeModal()" class="add-button">+ Добавить сеанс</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Зал</th>
                <th>Фильм</th>
                <th>Начало</th>
                <th>Окончание</th>
                <th>Цена от</th>
                <th>Скрыт</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="showtime in showtimes" :key="showtime.id">
                <td>{{ showtime.id }}</td>
                <td>{{ getHallName(showtime.hallId) }}</td>
                <td>{{ getFilmTitle(showtime.filmId) }}</td>
                <td>{{ formatDateTime(showtime.startAt) }}</td>
                <td>{{ formatDateTime(showtime.endAt) }}</td>
                <td>{{ showtime.priceFrom || '-' }}</td>
                <td>{{ showtime.isHidden ? 'Да' : 'Нет' }}</td>
                <td>
                  <button @click="openShowtimeModal(showtime)" class="edit-button">Редактировать</button>
                  <button @click="copyShowtime(showtime)" class="copy-button">Копировать</button>
                  <button @click="deleteShowtimeHandler(showtime.id!)" class="delete-button">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Расписание недели -->
      <div v-if="activeTab === 'schedule'" class="tab-content">
        <div class="section-header">
          <h2>Расписание на неделю</h2>
          <div class="week-selector">
            <button @click="previousWeek" class="week-nav-button">← Предыдущая</button>
            <span class="week-label">{{ currentWeekLabel }}</span>
            <button @click="nextWeek" class="week-nav-button">Следующая →</button>
          </div>
        </div>
        
        <div class="schedule-table-container">
          <table class="schedule-table">
            <thead>
              <tr>
                <th class="time-header">Время / Зал</th>
                <th v-for="hall in halls" :key="hall.id" class="hall-header">
                  {{ hall.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in weekDays" :key="day.date">
                <td class="day-cell">
                  <div class="day-name">{{ day.name }}</div>
                  <div class="day-date">{{ day.date }}</div>
                </td>
                <td
                  v-for="hall in halls"
                  :key="`${day.date}-${hall.id}`"
                  class="schedule-cell"
                  @click="openScheduleCell(day.date, hall.id)"
                >
                  <div class="cell-content">
                    <div
                      v-for="showtime in getShowtimesForCell(day.date, hall.id)"
                      :key="showtime.id"
                      class="showtime-item"
                      @click.stop="editShowtimeFromSchedule(showtime)"
                    >
                      <div class="showtime-time">{{ formatTime(showtime.startAt) }}</div>
                      <div class="showtime-title">{{ showtime.filmTitle }}</div>
                      <div class="showtime-format" v-if="showtime.format">{{ showtime.format }}</div>
                    </div>
                    <div v-if="getShowtimesForCell(day.date, hall.id).length === 0" class="empty-cell">
                      Кликните для добавления
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Залы -->
      <div v-if="activeTab === 'halls'" class="tab-content">
        <div class="section-header">
          <h2>Залы</h2>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Порядок</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hall in halls" :key="hall.id">
              <td>{{ hall.id }}</td>
              <td>
                <input
                  v-model="hall.name"
                  @blur="updateHallHandler(hall)"
                  class="inline-input"
                />
              </td>
              <td>
                <input
                  v-model.number="hall.sortOrder"
                  type="number"
                  @blur="updateHallHandler(hall)"
                  class="inline-input"
                  style="width: 80px"
                />
              </td>
              <td>
                <button @click="updateHallHandler(hall)" class="edit-button">Сохранить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Цены -->
      <div v-if="activeTab === 'prices'" class="tab-content">
        <div class="section-header">
          <h2>Цены</h2>
          <div class="prices-actions">
            <button @click="addPrice" class="add-button">+ Добавить цену</button>
            <button @click="savePrices" class="save-button" :disabled="pricesSaving">
              {{ pricesSaving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </div>
        <div v-if="pricesError" class="error-message">{{ pricesError }}</div>
        <div v-if="pricesSuccess" class="success-message">{{ pricesSuccess }}</div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 60px">№</th>
                <th>Цена (₽)</th>
                <th style="width: 120px">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(price, index) in pricesList" :key="index">
                <td>{{ index + 1 }}</td>
                <td>
                  <input
                    v-model.number="pricesList[index]"
                    type="number"
                    min="0"
                    step="50"
                    class="inline-input"
                    @input="pricesChanged = true"
                  />
                </td>
                <td>
                  <button @click="removePrice(index)" class="delete-button">Удалить</button>
                </td>
              </tr>
              <tr v-if="pricesList.length === 0">
                <td colspan="3" style="text-align: center; color: #999; padding: 20px;">
                  Нет цен. Добавьте первую цену.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Модальное окно фильма -->
    <div v-if="filmModalOpen" class="modal-overlay" @click.self="closeFilmModal">
      <div class="modal modal-large">
        <h3>{{ editingFilm?.id ? 'Редактировать фильм' : 'Добавить фильм' }}</h3>
        
        <div class="film-modal-content">
          <!-- Превью постера слева -->
          <div class="film-poster-preview">
            <div v-if="filmForm.posterUrl" class="poster-image-container">
              <img :src="filmForm.posterUrl" alt="Постер фильма" class="poster-image" @error="handlePosterError" />
            </div>
            <div v-else class="poster-placeholder">
              <span>Нет постера</span>
            </div>
          </div>
          
          <!-- Форма справа -->
          <div class="film-form-container">
            <!-- Поиск фильма по ID Кинопоиска -->
            <div v-if="!editingFilm?.id" class="film-search-section">
              <div class="form-group">
                <label>ID фильма на Кинопоиске</label>
                <div class="search-input-group">
                  <input
                    v-model="filmSearchQuery"
                    @keydown.enter.prevent="loadFilmById"
                    type="number"
                    placeholder="Введите ID фильма (например: 570402)"
                    class="search-input"
                  />
                  <button
                    type="button"
                    @click="loadFilmById"
                    :disabled="filmSearchLoading || !canLoadFilm"
                    class="search-button"
                  >
                    {{ filmSearchLoading ? 'Загрузка...' : 'Загрузить' }}
                  </button>
                </div>
                <div v-if="filmSearchError" class="error-message">{{ filmSearchError }}</div>
                <div class="search-hint">
                  ID можно найти в URL страницы фильма на kinopoisk.ru (например: kinopoisk.ru/film/570402)
                </div>
              </div>
            </div>
            
            <form @submit.prevent="saveFilm" class="modal-form">
          <div class="form-group">
            <label>Название *</label>
            <input v-model="filmForm.title" required />
          </div>
          <div class="form-group">
            <label>Длительность (мин) *</label>
            <input v-model.number="filmForm.durationMin" type="number" required min="1" />
          </div>
          <div class="form-group">
            <label>Возрастной рейтинг *</label>
            <select v-model="filmForm.ageRating" required>
              <option value="0+">0+</option>
              <option value="6+">6+</option>
              <option value="12+">12+</option>
              <option value="16+">16+</option>
              <option value="18+">18+</option>
            </select>
          </div>
          <div class="form-group">
            <label>Формат</label>
            <select v-model="filmForm.format">
              <option value="2D">2D</option>
              <option value="3D">3D</option>
              <option value="IMAX">IMAX</option>
              <option value="IMAX 3D">IMAX 3D</option>
              <option value="4DX">4DX</option>
              <option value="VIP">VIP</option>
              <option :value="null">Не указан</option>
            </select>
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea v-model="filmForm.description" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label>URL постера</label>
            <input v-model="filmForm.posterUrl" type="url" />
          </div>
          <div class="form-group">
            <label>
              <input v-model="filmForm.isActive" type="checkbox" />
              Активен
            </label>
          </div>
              <div v-if="filmError" class="error-message">{{ filmError }}</div>
              <div class="modal-actions">
                <button type="button" @click="closeFilmModal" class="cancel-button">Отмена</button>
                <button type="submit" class="save-button">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно сеанса -->
    <div v-if="showtimeModalOpen" class="modal-overlay" @click.self="closeShowtimeModal">
      <div class="modal">
        <h3>{{ isCopyingShowtime ? 'Копировать сеанс' : editingShowtime?.id ? 'Редактировать сеанс' : 'Добавить сеанс' }}</h3>
        <form @submit.prevent="saveShowtime" class="modal-form">
          <div class="form-group">
            <label>Зал *</label>
            <select v-model.number="showtimeForm.hallId" required>
              <option v-for="hall in halls" :key="hall.id" :value="hall.id">
                {{ hall.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Фильм *</label>
            <select v-model.number="showtimeForm.filmId" required>
              <option v-for="film in films" :key="film.id" :value="film.id">
                {{ film.title }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Дата и время начала *</label>
            <input
              v-model="showtimeForm.startAt"
              type="datetime-local"
              required
              step="60"
            />
          </div>
          <div class="form-group">
            <label>Цена от (₽)</label>
            <input 
              v-model.number="showtimeForm.priceFrom" 
              type="number" 
              min="0" 
              list="price-list"
              placeholder="Выберите или введите сумму"
            />
            <datalist id="price-list">
              <option v-for="price in availablePrices" :key="price" :value="price">
                {{ price }} ₽
              </option>
            </datalist>
          </div>
          <div class="form-group">
            <label>Примечание</label>
            <input v-model="showtimeForm.note" />
          </div>
          <div class="form-group">
            <label>
              <input v-model="showtimeForm.isHidden" type="checkbox" />
              Скрыт
            </label>
          </div>
          <div v-if="showtimeError" class="error-message">{{ showtimeError }}</div>
          <div class="modal-actions">
            <button type="button" @click="closeShowtimeModal" class="cancel-button">Отмена</button>
            <button type="submit" class="save-button">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logout, getMe } from '../api/auth'
import {
  getFilms,
  createFilm,
  updateFilm,
  deleteFilm,
  getShowtimes,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  getHalls,
  updateHall,
  getPrices,
  updatePrices,
  type Film,
  type Showtime,
  type Hall
} from '../api/admin'
import { getFilmById, type KinopoiskFilm } from '../api/kinopoisk'

const router = useRouter()
const user = ref<any>(null)

// Доступные суммы из JSON файла (загружаются через API)
const availablePrices = ref<number[]>([])

// Цены для редактирования
const pricesList = ref<number[]>([])
const pricesChanged = ref(false)
const pricesSaving = ref(false)
const pricesError = ref('')
const pricesSuccess = ref('')

// Загружаем сохраненный таб из localStorage или используем 'films' по умолчанию
const savedTab = localStorage.getItem('adminActiveTab') as 'films' | 'showtimes' | 'schedule' | 'halls' | 'prices' | null
const defaultTab: 'films' | 'showtimes' | 'schedule' | 'halls' | 'prices' = savedTab && ['films', 'showtimes', 'schedule', 'halls', 'prices'].includes(savedTab) 
  ? savedTab 
  : 'films'

const activeTab = ref<'films' | 'showtimes' | 'schedule' | 'halls' | 'prices'>(defaultTab)
const tabs = ['films', 'showtimes', 'schedule', 'halls', 'prices'] as const
const tabLabels = {
  films: 'Фильмы',
  showtimes: 'Сеансы',
  schedule: 'Расписание',
  halls: 'Залы',
  prices: 'Цены'
}

// Сохраняем активный таб в localStorage при изменении
watch(activeTab, (newTab) => {
  localStorage.setItem('adminActiveTab', newTab)
  
  // Загружаем данные при переключении на соответствующий таб
  if (newTab === 'schedule') {
    loadWeekShowtimes()
  } else if (newTab === 'prices') {
    loadPrices()
  }
})

// Расписание недели
const currentWeekStart = ref<Date>(getWeekStartForToday())
const weekShowtimes = ref<any[]>([])

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Четверг = 4, сдвигаем к началу недели (четверг)
  // Если день < 4 (пн-ср), отнимаем дни до четверга прошлой недели
  // Если день >= 4 (чт-вс), отнимаем дни до четверга текущей недели
  let diff: number
  if (day === 0) { // Воскресенье
    diff = -3
  } else if (day < 4) { // Понедельник-среда
    diff = day + 3 // До четверга прошлой недели
  } else { // Четверг-суббота
    diff = day - 4 // До четверга текущей недели
  }
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekStartForToday(): Date {
  // Получаем текущую дату в часовом поясе Екатеринбурга
  const now = new Date()
  const todayYekaterinburg = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Yekaterinburg' }))
  todayYekaterinburg.setHours(0, 0, 0, 0)
  
  // Всегда показываем неделю, которая включает сегодня
  // getWeekStart уже вычисляет правильное начало недели для любого дня
  return getWeekStart(todayYekaterinburg)
}

function getWeekDays(startDate: Date): Array<{ name: string; date: string }> {
  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
  const result: Array<{ name: string; date: string }> = []
  
  // Получаем текущую дату в часовом поясе Екатеринбурга
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' }) // YYYY-MM-DD формат
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    date.setHours(12, 0, 0, 0) // Устанавливаем полдень для избежания проблем с часовыми поясами
    
    // Получаем дату в формате YYYY-MM-DD в часовом поясе Екатеринбурга
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' })
    
    // Получаем день недели для этой даты в часовом поясе Екатеринбурга
    const dayOfWeekStr = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: 'Asia/Yekaterinburg'
    })
    const dayOfWeekMap: { [key: string]: number } = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    const dayOfWeek = dayOfWeekMap[dayOfWeekStr] ?? 0
    const dayName = dayNames[dayOfWeek]
    
    // Показываем только будущие дни или сегодня (не прошедшие дни)
    if (dateStr >= todayStr) {
      result.push({
        name: dayName,
        date: dateStr
      })
    }
  }
  
  return result
}

const weekDays = computed(() => getWeekDays(currentWeekStart.value))

const currentWeekLabel = computed(() => {
  const start = currentWeekStart.value
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
})

function previousWeek() {
  const newDate = new Date(currentWeekStart.value)
  newDate.setDate(newDate.getDate() - 7)
  currentWeekStart.value = newDate
  loadWeekShowtimes()
}

function nextWeek() {
  const newDate = new Date(currentWeekStart.value)
  newDate.setDate(newDate.getDate() + 7)
  currentWeekStart.value = newDate
  loadWeekShowtimes()
}

async function loadWeekShowtimes() {
  try {
    // Получаем даты начала и конца недели в часовом поясе Екатеринбурга
    const startDate = new Date(currentWeekStart.value)
    startDate.setHours(12, 0, 0, 0)
    const startDateStr = startDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' })
    
    const endDate = new Date(currentWeekStart.value)
    endDate.setDate(currentWeekStart.value.getDate() + 6)
    endDate.setHours(12, 0, 0, 0)
    const endDateStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' })
    
    // Загружаем все сеансы за неделю одним запросом (оптимизация)
    const allShowtimes = await getShowtimes({ startDate: startDateStr, endDate: endDateStr })
    
    weekShowtimes.value = allShowtimes
  } catch (error) {
    console.error('Error loading week showtimes:', error)
    weekShowtimes.value = []
  }
}

function getShowtimesForCell(date: string, hallId: number) {
  return weekShowtimes.value.filter(s => {
    // Получаем дату сеанса в часовом поясе Екатеринбурга
    const showtimeDateObj = new Date(s.startAt)
    const showtimeDateStr = showtimeDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' })
    
    return showtimeDateStr === date && s.hallId === hallId && !s.isHidden
  }).sort((a, b) => a.startAt.localeCompare(b.startAt))
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Asia/Yekaterinburg'
  })
}

const scheduleCellDate = ref<string>('')
const scheduleCellHallId = ref<number | null>(null)

function openScheduleCell(date: string, hallId: number) {
  scheduleCellDate.value = date
  scheduleCellHallId.value = hallId
  // Открываем модальное окно сеанса с предзаполненными данными
  showtimeForm.value = {
    hallId,
    filmId: undefined,
    startAt: `${date}T10:00`,
    priceFrom: null,
    note: null,
    isHidden: false
  }
  editingShowtime.value = null
  showtimeModalOpen.value = true
}

function editShowtimeFromSchedule(showtime: any) {
  editingShowtime.value = showtime
  showtimeForm.value = {
    hallId: showtime.hallId,
    filmId: showtime.filmId,
    startAt: showtime.startAt.slice(0, 16), // datetime-local format
    priceFrom: showtime.priceFrom,
    note: showtime.note,
    isHidden: showtime.isHidden
  }
  showtimeModalOpen.value = true
}

const films = ref<Film[]>([])
const showtimes = ref<Showtime[]>([])
const halls = ref<Hall[]>([])

const filmModalOpen = ref(false)
const editingFilm = ref<Film | null>(null)
const filmForm = ref<Partial<Film>>({
  title: '',
  durationMin: 90,
  ageRating: '0+',
  format: '2D',
  description: null,
  posterUrl: null,
  isActive: true,
  kinopoiskId: null
})
const filmError = ref('')

// Загрузка фильма по ID
const filmSearchQuery = ref<string | number>('')
const filmSearchLoading = ref(false)
const filmSearchError = ref('')

const canLoadFilm = computed(() => {
  const query = filmSearchQuery.value
  if (!query) return false
  if (typeof query === 'number') return query > 0
  if (typeof query === 'string') return query.trim().length > 0
  return false
})

const showtimeModalOpen = ref(false)
const editingShowtime = ref<Showtime | null>(null)
const isCopyingShowtime = ref(false)
const showtimeForm = ref<Partial<Showtime>>({
  hallId: 1,
  filmId: 0,
  startAt: '',
  priceFrom: null,
  note: null,
  isHidden: false
})
const showtimeError = ref('')
const showtimeFilters = ref({
  date: new Date().toISOString().split('T')[0],
  hallId: undefined as number | undefined
})

async function loadUser() {
  try {
    user.value = await getMe()
  } catch {
    router.push('/admin/login')
  }
}

async function handleLogout() {
  await logout()
  router.push('/admin/login')
}

async function loadFilms() {
  films.value = await getFilms()
}

async function loadShowtimes() {
  const params: any = {}
  if (showtimeFilters.value.date) {
    params.date = showtimeFilters.value.date
  }
  if (showtimeFilters.value.hallId) {
    params.hallId = showtimeFilters.value.hallId
  }
  showtimes.value = await getShowtimes(params)
}

async function loadHalls() {
  halls.value = await getHalls()
}

function openFilmModal(film?: Film) {
  editingFilm.value = film || null
  if (film) {
    filmForm.value = { ...film }
  } else {
    filmForm.value = {
      title: '',
      durationMin: 90,
      ageRating: '0+',
      format: '2D',
      description: null,
      posterUrl: null,
      isActive: true,
      kinopoiskId: null
    }
  }
  filmError.value = ''
  filmSearchQuery.value = ''
  filmSearchError.value = ''
  filmModalOpen.value = true
}

function closeFilmModal() {
  filmModalOpen.value = false
  editingFilm.value = null
  filmError.value = ''
  filmSearchQuery.value = ''
  filmSearchError.value = ''
}

function handlePosterError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  if (img.parentElement) {
    img.parentElement.innerHTML = '<div class="poster-error">Ошибка загрузки изображения</div>'
  }
}

function handleTablePosterError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  if (img.parentElement) {
    img.parentElement.innerHTML = '<span class="no-poster">—</span>'
  }
}

async function loadFilmById() {
  const query = filmSearchQuery.value
  if (!query || (typeof query === 'string' && query.trim() === '')) {
    filmSearchError.value = 'Введите ID фильма'
    return
  }
  
  const filmId = typeof query === 'number' ? query : parseInt(String(query).trim(), 10)
  if (isNaN(filmId)) {
    filmSearchError.value = 'ID должен быть числом'
    return
  }
  
  filmSearchLoading.value = true
  filmSearchError.value = ''
  
  try {
    const result = await getFilmById(filmId)
    if (result && result.film) {
      // Автоматически заполняем форму
      filmForm.value = {
        title: result.film.title,
        durationMin: result.film.durationMin || 90,
        ageRating: result.film.ageRating || '0+',
        format: filmForm.value.format || '2D', // Оставляем формат, если был указан, иначе по умолчанию 2D
        description: result.film.description || null,
        posterUrl: result.film.posterUrl || null,
        isActive: filmForm.value.isActive !== undefined ? filmForm.value.isActive : true,
        kinopoiskId: result.film.kinopoiskId || result.film.id // Сохраняем ID Кинопоиска
      }
      
      // Очищаем поле поиска после успешной загрузки
      filmSearchQuery.value = ''
      filmSearchError.value = ''
    } else {
      filmSearchError.value = 'Фильм не найден'
    }
  } catch (error: any) {
    filmSearchError.value = error.response?.data?.message || error.response?.data?.error || error.message || 'Ошибка загрузки фильма'
    console.error('Load film error:', error)
  } finally {
    filmSearchLoading.value = false
  }
}

async function saveFilm() {
  filmError.value = ''
  try {
    if (editingFilm.value?.id) {
      await updateFilm(editingFilm.value.id, filmForm.value)
    } else {
      await createFilm(filmForm.value as Film)
    }
    await loadFilms()
    closeFilmModal()
  } catch (err: any) {
    // Показываем понятное сообщение об ошибке
    if (err.response?.status === 409) {
      filmError.value = err.response?.data?.message || 'Этот фильм уже добавлен в базу'
    } else {
      filmError.value = err.response?.data?.message || err.response?.data?.error || 'Ошибка сохранения'
    }
  }
}

async function deleteFilmHandler(id: number) {
  if (confirm('Удалить фильм?')) {
    await deleteFilm(id)
    await loadFilms()
  }
}

function openShowtimeModal(showtime?: Showtime) {
  editingShowtime.value = showtime || null
  isCopyingShowtime.value = false
  if (showtime) {
    // Конвертируем ISO datetime в datetime-local формат
    const startDate = new Date(showtime.startAt)
    const localDateTime = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    
    showtimeForm.value = {
      ...showtime,
      startAt: localDateTime
    }
  } else {
    const now = new Date()
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    
    showtimeForm.value = {
      hallId: 1,
      filmId: films.value[0]?.id || 0,
      startAt: localDateTime,
      priceFrom: null,
      note: null,
      isHidden: false
    }
  }
  showtimeError.value = ''
  showtimeModalOpen.value = true
}

function copyShowtime(showtime: Showtime) {
  // Копируем сеанс, но без id, чтобы создать новый
  editingShowtime.value = null
  isCopyingShowtime.value = true
  // Конвертируем ISO datetime в datetime-local формат
  const startDate = new Date(showtime.startAt)
  const localDateTime = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
  
  showtimeForm.value = {
    hallId: showtime.hallId,
    filmId: showtime.filmId,
    startAt: localDateTime,
    priceFrom: showtime.priceFrom,
    note: showtime.note,
    isHidden: showtime.isHidden
  }
  showtimeError.value = ''
  showtimeModalOpen.value = true
}

function closeShowtimeModal() {
  showtimeModalOpen.value = false
  editingShowtime.value = null
  isCopyingShowtime.value = false
  showtimeError.value = ''
}

async function saveShowtime() {
  showtimeError.value = ''
  try {
    // Конвертируем datetime-local в ISO
    const localDateTime = showtimeForm.value.startAt!
    const isoDateTime = new Date(localDateTime).toISOString()
    
    const data = {
      ...showtimeForm.value,
      startAt: isoDateTime
    }
    
    if (editingShowtime.value?.id) {
      await updateShowtime(editingShowtime.value.id, data)
    } else {
      await createShowtime(data as Showtime)
    }
    await loadShowtimes()
    await loadWeekShowtimes() // Обновляем расписание недели
    closeShowtimeModal()
  } catch (err: any) {
    showtimeError.value = err.response?.data?.message || err.response?.data?.error || 'Ошибка сохранения'
  }
}

async function deleteShowtimeHandler(id: number) {
  if (confirm('Удалить сеанс?')) {
    try {
      await deleteShowtime(id)
      await loadShowtimes()
      await loadWeekShowtimes() // Обновляем расписание недели
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления')
    }
  }
}

async function updateHallHandler(hall: Hall) {
  await updateHall(hall.id, hall)
  await loadHalls()
}

function getHallName(hallId: number) {
  return halls.value.find(h => h.id === hallId)?.name || `Зал ${hallId}`
}

function getFilmTitle(filmId: number) {
  return films.value.find(f => f.id === filmId)?.title || `Фильм #${filmId}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Yekaterinburg'
  })
}

async function loadPrices() {
  try {
    const prices = await getPrices()
    pricesList.value = [...prices]
    availablePrices.value = [...prices]
    pricesChanged.value = false
    pricesError.value = ''
    pricesSuccess.value = ''
  } catch (err: any) {
    // Если API недоступен, используем значения по умолчанию
    const defaultPrices = [250, 300, 350, 400, 500]
    pricesList.value = [...defaultPrices]
    availablePrices.value = [...defaultPrices]
    pricesError.value = err.response?.data?.error || 'Ошибка загрузки цен. Используются значения по умолчанию.'
  }
}

async function savePrices() {
  if (!pricesChanged.value) {
    pricesSuccess.value = 'Нет изменений для сохранения'
    setTimeout(() => { pricesSuccess.value = '' }, 2000)
    return
  }

  pricesSaving.value = true
  pricesError.value = ''
  pricesSuccess.value = ''
  
  try {
    // Валидация
    if (pricesList.value.length === 0) {
      pricesError.value = 'Добавьте хотя бы одну цену'
      pricesSaving.value = false
      return
    }

    if (!pricesList.value.every(p => typeof p === 'number' && p > 0)) {
      pricesError.value = 'Все цены должны быть положительными числами'
      pricesSaving.value = false
      return
    }

    const savedPrices = await updatePrices(pricesList.value)
    pricesList.value = [...savedPrices]
    availablePrices.value = [...savedPrices]
    pricesChanged.value = false
    pricesSuccess.value = 'Цены успешно сохранены!'
    setTimeout(() => { pricesSuccess.value = '' }, 3000)
  } catch (err: any) {
    pricesError.value = err.response?.data?.error || err.response?.data?.message || 'Ошибка сохранения цен'
  } finally {
    pricesSaving.value = false
  }
}

function addPrice() {
  const lastPrice = pricesList.value.length > 0 
    ? pricesList.value[pricesList.value.length - 1] 
    : 500
  pricesList.value.push(lastPrice + 50)
  pricesChanged.value = true
}

function removePrice(index: number) {
  if (pricesList.value.length <= 1) {
    pricesError.value = 'Должна остаться хотя бы одна цена'
    setTimeout(() => { pricesError.value = '' }, 2000)
    return
  }
  pricesList.value.splice(index, 1)
  pricesChanged.value = true
}

onMounted(async () => {
  await loadUser()
  await loadFilms()
  await loadShowtimes()
  await loadHalls()
  await loadWeekShowtimes()
  await loadPrices()
})

</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.admin-header {
  background: #1a1a2e;
  color: white;
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-header h1 {
  margin: 0;
  font-size: 24px;
}

.admin-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.logout-button {
  padding: 8px 16px;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.logout-button:hover {
  background: #b71c1c;
}

.admin-tabs {
  background: white;
  border-bottom: 2px solid #ddd;
  display: flex;
  padding: 0 40px;
}

.tab-button {
  padding: 16px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #00d4ff;
}

.tab-button.active {
  color: #00d4ff;
  border-bottom-color: #00d4ff;
}

.admin-content {
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.tab-content {
  background: white;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: visible;
}

.tab-content:has(.schedule-table-container) {
  padding-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-header h2 {
  margin: 0;
  font-size: 24px;
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.filter-button {
  padding: 8px 16px;
  background: #00d4ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.add-button {
  padding: 10px 20px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.add-button:hover {
  background: #45a049;
}

.table-container {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  overflow-x: auto;
  margin-top: 20px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.data-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table tr:hover {
  background: #f9f9f9;
}

/* Расписание недели */
.week-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.week-nav-button {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.week-nav-button:hover {
  background: #e0e0e0;
}

.week-label {
  font-weight: 600;
  color: #333;
  min-width: 200px;
  text-align: center;
}

.schedule-table-container {
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
  margin-top: 20px;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  min-width: 800px;
}

.schedule-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: center;
  font-weight: 600;
  border: 1px solid #ddd;
}

.time-header {
  min-width: 120px;
}

.hall-header {
  min-width: 200px;
}

.schedule-table td {
  border: 1px solid #ddd;
  padding: 0;
  vertical-align: top;
}

.day-cell {
  background: #f9f9f9;
  padding: 12px !important;
  text-align: center;
  font-weight: 600;
  min-width: 120px;
}

.day-name {
  font-size: 16px;
  color: #333;
  margin-bottom: 4px;
}

.day-date {
  font-size: 12px;
  color: #666;
}

.schedule-cell {
  min-height: 150px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.schedule-cell:hover {
  background: #f0f7ff;
}

.cell-content {
  padding: 8px;
  min-height: 150px;
}

.empty-cell {
  color: #999;
  font-size: 12px;
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.showtime-item {
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.showtime-item:hover {
  background: #bbdefb;
  border-color: #64b5f6;
}

.showtime-time {
  font-weight: 600;
  font-size: 14px;
  color: #1976d2;
  margin-bottom: 4px;
}

.showtime-title {
  font-size: 13px;
  color: #333;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.showtime-format {
  font-size: 11px;
  color: #666;
  font-style: italic;
}

.poster-cell {
  width: 60px;
  padding: 8px !important;
  text-align: center;
}

.table-poster {
  width: 50px;
  height: 75px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #ddd;
  background: #f5f5f5;
  display: inline-block;
}

.table-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.no-poster {
  color: #999;
  font-size: 14px;
}

.inline-input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
}

.edit-button,
.copy-button,
.delete-button {
  padding: 6px 12px;
  margin-right: 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.edit-button {
  background: #2196f3;
  color: white;
}

.edit-button:hover {
  background: #1976d2;
}

.copy-button {
  background: #ff9800;
  color: white;
}

.copy-button:hover {
  background: #f57c00;
}

.delete-button {
  background: #f44336;
  color: white;
}

.delete-button:hover {
  background: #d32f2f;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 30px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 1000px;
}

.film-modal-content {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}

.film-poster-preview {
  flex-shrink: 0;
  width: 250px;
}

.poster-image-container {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #ddd;
  background: #f5f5f5;
}

.poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-placeholder {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 8px;
  border: 2px dashed #ddd;
  background: #f9f9f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

.poster-error {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 8px;
  border: 2px solid #ff6b6b;
  background: #ffe0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d63031;
  font-size: 14px;
  text-align: center;
  padding: 10px;
}

.film-form-container {
  flex: 1;
  min-width: 0;
}

.modal h3 {
  margin: 0 0 24px 0;
  font-size: 24px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 8px;
}

.error-message {
  color: #d32f2f;
  font-size: 14px;
  padding: 12px;
  background: #ffebee;
  border-radius: 6px;
  margin-bottom: 16px;
}

.success-message {
  color: #2e7d32;
  font-size: 14px;
  padding: 12px;
  background: #e8f5e9;
  border-radius: 6px;
  margin-bottom: 16px;
}

.prices-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.cancel-button,
.save-button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.cancel-button {
  background: #ddd;
  color: #333;
}

.cancel-button:hover {
  background: #ccc;
}

.save-button {
  background: #00d4ff;
  color: white;
}

.save-button:hover {
  background: #00b8d4;
}

.film-search-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.search-input-group {
  display: flex;
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.search-button {
  padding: 10px 20px;
  background: #00d4ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}

.search-button:hover:not(:disabled) {
  background: #00b8d4;
}

.search-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-hint {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
  font-style: italic;
}
</style>
