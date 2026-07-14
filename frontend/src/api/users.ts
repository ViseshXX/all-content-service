import { apiClient } from './client'

export interface CmsUser {
  virtualId: number
  username: string
  email?: string
  role: 'admin' | 'curator'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserPayload {
  username: string
  password: string
  email?: string
  role: 'admin' | 'curator'
}

export interface UpdateUserPayload {
  username?: string
  email?: string
  role?: 'admin' | 'curator'
}

export async function getUsers(): Promise<CmsUser[]> {
  const res = await apiClient.get('/users')
  return res.data.data
}

export async function createUser(payload: CreateUserPayload): Promise<CmsUser> {
  const res = await apiClient.post('/users', payload)
  return res.data.data
}

export async function updateUser(virtualId: number, payload: UpdateUserPayload): Promise<CmsUser> {
  const res = await apiClient.put(`/users/${virtualId}`, payload)
  return res.data.data
}

export async function deactivateUser(virtualId: number): Promise<void> {
  await apiClient.delete(`/users/${virtualId}`)
}

export async function changePassword(virtualId: number, newPassword: string): Promise<void> {
  await apiClient.put(`/users/${virtualId}/password`, { password: newPassword })
}
