import { apiClient } from './client'
import type { Collection } from '@/types'

export interface CollectionPayload {
  name: string
  category: string
  language: string
  status: string
  tags: string[]
  description?: string
  author?: string
  publisher?: string
  edition?: string
  imagePath?: string
  difficultyLevel?: string
  ageGroup?: string
  level_complexity?: {
    level?: string
    level_competency?: string
    CEFR_level?: string
  }
}

export async function fetchCollections(): Promise<Collection[]> {
  const res = await apiClient.get('/collection')
  return res.data.data
}

export async function fetchCollectionById(id: string): Promise<Collection> {
  const res = await apiClient.get(`/collection/${id}`)
  return res.data.collection
}

export async function createCollection(payload: CollectionPayload): Promise<Collection> {
  const res = await apiClient.post('/collection', payload)
  return res.data.data
}

export async function updateCollection(id: string, payload: Partial<CollectionPayload>): Promise<Collection> {
  const res = await apiClient.put(`/collection/${id}`, payload)
  return res.data.updated
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient.delete(`/collection/${id}`)
}
