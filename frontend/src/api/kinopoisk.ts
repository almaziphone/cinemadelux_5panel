import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
})

export interface KinopoiskFilm {
  id: number
  kinopoiskId: number
  title: string
  alternativeName?: string | null
  enName?: string | null
  year?: number
  durationMin?: number
  description?: string | null
  posterUrl?: string | null
  ageRating: '0+' | '6+' | '12+' | '16+' | '18+'
  rating?: number | null
  genres?: string[]
  countries?: string[]
}

export async function getFilmById(id: number): Promise<{ film: KinopoiskFilm }> {
  try {
    const response = await api.get<{ film: KinopoiskFilm }>(`/kinopoisk/film/${id}`)
    if (!response.data || !response.data.film) {
      throw new Error('Film not found')
    }
    return response.data
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.error || 'Ошибка получения фильма')
    }
    throw error
  }
}
