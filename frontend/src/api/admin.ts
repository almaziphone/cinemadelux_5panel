import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
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
