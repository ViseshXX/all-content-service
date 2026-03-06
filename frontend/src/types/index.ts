export type ContentType = 'Word' | 'Sentence' | 'Paragraph' | 'Char'
export type Language = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'gu'
export type Status = 'live' | 'draft'

export interface ContentSourceDataItem {
  language: Language
  text: string
  audioUrl?: string
  inst_audioUrl?: string
  // computed fields (read-only in UI)
  phonemes?: string[]
  wordCount?: number
  syllableCount?: number
  syllableCountMap?: Record<string, number>
  wordFrequency?: Record<string, number>
  wordMeasures?: unknown[]
  totalOrthoComplexity?: number
  totalPhonicComplexity?: number
  meanComplexity?: number
  readingComplexity?: number
}

export interface MechanicsOption {
  text: string
  audio_url?: string
  image_url?: string
  isAns: boolean
  side?: string
}

export interface MechanicsEntry {
  mechanics_id: string
  language: Language
  content_body?: string
  text?: string
  jumbled_text?: string
  audio_url?: string
  image_url?: string
  time_limit?: number
  options?: MechanicsOption[]
  hints?: { text?: string; audio_url?: string; image_url?: string }
  correctness?: { '50%': string[] }
  syllable?: { text: string; audio_url?: string }[]
  words?: string[]
  imageAudioMap?: {
    text: string
    multilingual_id?: string
    audio_url?: string
    image_url?: string
  }[]
}

export interface LevelComplexity {
  level: string
  level_competency: string
  CEFR_level?: string
}

export interface Content {
  _id: string
  contentId: string
  collectionId?: string
  name: string
  contentType: ContentType
  language: Language
  status: Status
  tags: string[]
  contentSourceData: ContentSourceDataItem[]
  mechanics_data?: MechanicsEntry[]
  multilingual?: Record<string, { text: string; audio_url?: string }>
  level_complexity?: LevelComplexity
  imagePath?: string
  contentIndex?: number
  publisher?: string
  createdAt?: string
  updatedAt?: string
}

export interface Collection {
  _id: string
  collectionId: string
  name: string
  category: ContentType
  language: Language
  status: Status
  tags: string[]
  description?: string
  author?: string
  publisher?: string
  edition?: string
  imagePath?: string
  difficultyLevel?: string
  ageGroup?: string
  level_complexity?: LevelComplexity
  createdAt?: string
  updatedAt?: string
}

export interface PaginationResponse {
  status: string
  data: Content[]
  totalSyllableCount?: number
}

export interface ContentFilters {
  type?: ContentType | ''
  collectionId?: string
  page: number
  limit: number
}
