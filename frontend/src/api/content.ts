import { apiClient } from './client'
import type { Content, ContentType } from '@/types'

export interface ContentPayload {
  name: string
  contentType: string
  language: string
  status: string
  tags: string[]
  contentSourceData: {
    language: string
    text: string
    audioUrl?: string
    inst_audioUrl?: string
  }[]
  collectionId?: string
  imagePath?: string
  contentIndex?: number
  publisher?: string
  level_complexity?: {
    level: string
    level_competency: string
    CEFR_level?: string
  }
  mechanics_data?: unknown[]
  multilingual?: Record<string, { text: string; audio_url?: string }>
}

export interface ContentListParams {
  language: string
  contentType?: ContentType | ''
  collectionId?: string
  limit?: number
  tags?: string[]
}

export async function getContentList(params: ContentListParams): Promise<Content[]> {
  const body: Record<string, unknown> = {
    language: params.language,
    tags: params.tags ?? [],
    tokenArr: [],
    limit: params.limit ?? 20,
    cLevel: '',
    complexityLevel: [],
    graphemesMappedObj: {},
    level_competency: [],
  }
  if (params.contentType) body.contentType = params.contentType
  if (params.collectionId) body.collectionId = params.collectionId

  const res = await apiClient.post('/content/getContent', body)
  return res.data.data?.wordsArr ?? []
}

export async function fetchContentByIds(ids: string[]): Promise<Content[]> {
  const res = await apiClient.get('/content/getByIds', {
    params: { ids: ids.join(',') },
  })
  return res.data.contents
}

export async function createContent(payload: ContentPayload): Promise<Content> {
  const res = await apiClient.post('/content', payload)
  return res.data.data
}

export async function updateContent(id: string, payload: Partial<ContentPayload>): Promise<Content> {
  const res = await apiClient.put(`/content/${id}`, payload)
  return res.data.data ?? res.data
}

export async function deleteContent(id: string): Promise<void> {
  await apiClient.delete(`/content/${id}`)
}
