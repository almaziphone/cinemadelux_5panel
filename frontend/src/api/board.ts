import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
})

export interface BoardShowtime {
  id: number
  startAt: string
  time: string
  endAt: string
  hallId: number
  hallName: string
  priceFrom: number | null
  note: string | null
  isHidden?: boolean
}

export interface BoardFilm {
  id: number
  title: string
  posterUrl: string | null
  ageRating: string
  format: string | null
  durationMin: number
  description: string | null
  showtimes: BoardShowtime[]
}

export interface BoardResponse {
  date: string
  films: BoardFilm[]
}

export interface Premier {
  id: number
  title: string
  videoUrl: string
  sortOrder: number
  createdAt?: string
}

export async function getBoard(date?: string): Promise<BoardResponse> {
  const params = date ? { date } : {}
  const response = await api.get<BoardResponse>('/board', { params })
  return response.data
}

export async function getPremieres(): Promise<Premier[]> {
  const response = await api.get<{ premieres: Premier[] }>('/board/premieres')
  return response.data.premieres
}
