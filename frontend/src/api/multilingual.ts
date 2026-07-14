import { apiClient } from './client'
import type { MultilingualEntry, MultilingualLangData } from '@/types'

export interface MultilingualListResult {
  items: MultilingualEntry[]
  total: number
}

export interface MultilingualPayload {
  multilingual_id: string
  multilingual: Record<string, MultilingualLangData>
}

export async function fetchMultilingualList(
  search?: string,
  limit = 20,
  page = 1,
): Promise<MultilingualListResult> {
  const params: Record<string, string> = { limit: String(limit), page: String(page) }
  if (search) params.search = search
  const res = await apiClient.get('/content/multilingual', { params })
  return res.data.data
}

export async function fetchMultilingualById(id: string): Promise<MultilingualEntry> {
  const res = await apiClient.get(`/content/multilingual/${id}`)
  return res.data.data
}

export async function fetchMultilingualByContentId(contentId: string): Promise<MultilingualEntry | null> {
  const res = await apiClient.get(`/content/multilingual/by-content/${contentId}`)
  return res.data.data
}

/** Returns the words that were NOT found in the multilingual collection. */
export async function validateMultilingualWords(words: string[]): Promise<string[]> {
  const res = await apiClient.get('/content/multilingual/validate', {
    params: { words: words.join(',') },
  })
  return res.data.data.missing as string[]
}

export async function createMultilingual(payload: MultilingualPayload): Promise<MultilingualEntry> {
  const res = await apiClient.post('/content/multilingual', payload)
  return res.data.data
}

export async function updateMultilingual(
  id: string,
  payload: Partial<MultilingualPayload>,
): Promise<MultilingualEntry> {
  const res = await apiClient.put(`/content/multilingual/${id}`, payload)
  return res.data.data
}

export async function deleteMultilingual(id: string): Promise<void> {
  await apiClient.delete(`/content/multilingual/${id}`)
}
