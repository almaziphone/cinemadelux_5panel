import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  timeout: 600000 // 10 минут для больших файлов
})

export interface Film {
  id?: number
  title: string
  durationMin: number
  ageRating: '0+' | '6+' | '12+' | '16+' | '18+'
  format: string | null
  description: string | null
  posterUrl: string | null
  isActive: boolean
  kinopoiskId?: number | null
}

export interface Showtime {
  id?: number
  hallId: number
  filmId: number
  startAt: string
  endAt?: string
  priceFrom: number | null
  note: string | null
  isHidden: boolean
}

export interface Hall {
  id: number
  name: string
  sortOrder: number
}

export interface Premier {
  id?: number
  title: string
  videoUrl: string
  sortOrder?: number
  createdAt?: string
}

export async function getFilms() {
  const response = await api.get('/admin/films')
  return response.data.films
}

export async function createFilm(film: Film) {
  const response = await api.post('/admin/films', film)
  return response.data.film
}

export async function updateFilm(id: number, film: Partial<Film>) {
  const response = await api.put(`/admin/films/${id}`, film)
  return response.data.film
}

export async function deleteFilm(id: number) {
  await api.delete(`/admin/films/${id}`)
}

export async function getShowtimes(params?: { date?: string; hallId?: number; startDate?: string; endDate?: string }) {
  const response = await api.get('/admin/showtimes', { params })
  return response.data.showtimes
}

export async function createShowtime(showtime: Showtime) {
  const response = await api.post('/admin/showtimes', showtime)
  return response.data.showtime
}

export async function updateShowtime(id: number, showtime: Partial<Showtime>) {
  const response = await api.put(`/admin/showtimes/${id}`, showtime)
  return response.data.showtime
}

export async function deleteShowtime(id: number) {
  await api.delete(`/admin/showtimes/${id}`)
}

export async function getHalls() {
  const response = await api.get('/admin/halls')
  return response.data.halls
}

export async function updateHall(id: number, hall: Partial<Hall>) {
  const response = await api.put(`/admin/halls/${id}`, hall)
  return response.data.hall
}

export async function getPrices() {
  const response = await api.get('/admin/prices')
  return response.data.prices
}

export async function updatePrices(prices: number[]) {
  const response = await api.put('/admin/prices', { prices })
  return response.data.prices
}

export async function getPremieres() {
  const response = await api.get('/admin/premieres')
  return response.data.premieres
}

export async function uploadPremierVideo(file: File): Promise<{ videoUrl: string; fileName: string }> {
  const formData = new FormData()
  formData.append('file', file)
  
  // Используем прямой URL к бэкенду для загрузки больших файлов, минуя прокси Vite
  // Это решает проблему с ECONNABORTED при проксировании больших файлов
  const backendUrl = import.meta.env.DEV 
    ? 'http://localhost:8080/api'  // В режиме разработки - прямой запрос к бэкенду
    : '/api'  // В продакшене используем обычный путь
  
  console.log('Creating upload request:', {
    url: `${backendUrl}/admin/premieres/upload`,
    fileSize: file.size,
    fileType: file.type,
    fileName: file.name,
    directBackend: import.meta.env.DEV
  })
  
  try {
    // Создаем отдельный axios instance для прямого запроса к бэкенду
    const uploadApi = axios.create({
      baseURL: backendUrl,
      withCredentials: true,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 600000 // 10 минут для больших файлов
    })
    
    // НЕ устанавливаем Content-Type вручную - браузер сам установит правильный заголовок с boundary
    const response = await uploadApi.post('/admin/premieres/upload', formData, {
      timeout: 600000, // 10 минут для больших файлов
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          console.log(`Upload progress: ${percentCompleted}% (${progressEvent.loaded}/${progressEvent.total} bytes)`)
        } else {
          console.log(`Upload progress: ${progressEvent.loaded} bytes uploaded`)
        }
      }
    })
    console.log('Upload response received:', response.status, response.data)
    return response.data
  } catch (error: any) {
    console.error('Upload request failed:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null,
      request: error.request ? 'Request sent but no response' : 'No request sent'
    })
    throw error
  }
}

export async function createPremier(premier: Premier) {
  const response = await api.post('/admin/premieres', premier)
  return response.data.premier
}

export async function updatePremier(id: number, premier: Partial<Premier>) {
  const response = await api.put(`/admin/premieres/${id}`, premier)
  return response.data.premier
}

export async function deletePremier(id: number) {
  await api.delete(`/admin/premieres/${id}`)
}
