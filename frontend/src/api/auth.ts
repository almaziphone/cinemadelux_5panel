import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
})

export async function login(username: string, password: string) {
  const response = await api.post('/auth/login', { username, password })
  return response.data
}

export async function logout() {
  const response = await api.post('/auth/logout')
  return response.data
}

export async function checkAuth() {
  try {
    const response = await api.get('/me')
    return response.data.user
  } catch {
    return null
  }
}

export async function getMe() {
  const response = await api.get('/me')
  return response.data.user
}
