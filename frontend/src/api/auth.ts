import { apiClient } from './client'

export interface LoginResponse {
  status: string
  data: {
    token: string
    user: {
      virtualId: number
      username: string
      role: string
      email?: string
    }
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post('/auth/login', { username, password })
  return res.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function getMe(): Promise<{ virtualId: number; username: string; role: string }> {
  const res = await apiClient.get('/auth/me')
  return res.data.data
}
