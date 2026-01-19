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

export async function getBoard(date?: string): Promise<BoardResponse> {
  const params = date ? { date } : {}
  const response = await api.get<BoardResponse>('/board', { params })
  return response.data
}
