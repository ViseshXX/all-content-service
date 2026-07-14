import { apiClient } from './client'
import type { Content } from '@/types'

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
  language: string | string[]
  contentType?: string
  collectionId?: string
  limit?: number
  tags?: string[]
  page?: number
  searchContentId?: string[]
  searchCollectionId?: string[]
  searchText?: string
  searchTags?: string[]
}

export interface ContentListResult {
  items: Content[]
  total: number
}

export async function getContentList(params: ContentListParams): Promise<ContentListResult> {
  const body: Record<string, unknown> = {
    language: params.language,
    tags: params.tags ?? [],
    tokenArr: [],
    limit: params.limit ?? 20,
    cLevel: '',
    complexityLevel: [],
    graphemesMappedObj: {},
    level_competency: [],
    page: params.page ?? 1,
  }
  if (params.contentType) body.contentType = params.contentType
  if (params.collectionId) body.collectionId = params.collectionId
  if (params.searchContentId) body.searchContentId = params.searchContentId
  if (params.searchCollectionId) body.searchCollectionId = params.searchCollectionId
  if (params.searchText) body.searchText = params.searchText
  if (params.searchTags?.length) body.searchTags = params.searchTags

  const res = await apiClient.post('/content/getContent', body)
  return {
    items: res.data.data?.wordsArr ?? [],
    total: res.data.data?.total ?? 0,
  }
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

export async function checkAssetExists(s3Key: string): Promise<boolean> {
  const res = await apiClient.get('/content/check-asset', { params: { key: s3Key } })
  return res.data.exists === true
}

export async function generateTts(text: string, language: string, filename: string, folder: string): Promise<string> {
  const res = await apiClient.post('/content/generate-tts', { text, language, filename, folder })
  return res.data.data.filename as string
}

export async function getDistinctTags(): Promise<string[]> {
  const res = await apiClient.get('/content/tags')
  return res.data.data ?? []
}

export async function deleteContent(id: string): Promise<void> {
  await apiClient.delete(`/content/${id}`)
}

export async function createContentWithAssets(
  templateType: string,
  fields: Record<string, string>,
  files: Record<string, File>,
): Promise<Content> {
  const formData = new FormData()
  formData.append('templateType', templateType)
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  for (const [key, file] of Object.entries(files)) {
    formData.append(key, file)
  }
  const res = await apiClient.post('/content/create-with-assets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })
  return res.data.data
}

/**
 * Upload a single audio or image file for an existing content item.
 * The backend converts audio to WAV (via FFmpeg) and compresses images (via Sharp),
 * then uploads to S3. If existingFilename is provided, the same S3 key is reused
 * (overwrite). Returns the stored filename (no path prefix).
 */
export async function uploadContentAsset(
  assetType: 'audio' | 'image',
  file: File,
  language?: string,
  existingFilename?: string,
  audioFolder?: string,
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('assetType', assetType)
  if (language) formData.append('language', language)
  if (existingFilename) formData.append('existingFilename', existingFilename)
  if (audioFolder) formData.append('audioFolder', audioFolder)
  const res = await apiClient.post('/content/upload-asset', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  })
  return res.data.data.filename as string
}
