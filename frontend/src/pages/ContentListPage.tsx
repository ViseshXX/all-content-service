import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Trash2, Filter, ChevronDown, X, ChevronLeft, ChevronRight, Eye, BookOpen, ListChecks } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { TemplatePickerDialog } from '@/components/content/TemplatePickerDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ReadAlongPreviewModal } from '@/components/content/ReadAlongPreviewModal'
import { MCQPreviewModal } from '@/components/content/MCQPreviewModal'
import { M1PreviewModal } from '@/components/content/M1PreviewModal'
import { M2PreviewModal } from '@/components/content/M2PreviewModal'
import { M3PreviewModal } from '@/components/content/M3PreviewModal'
import { FillBlanksPreviewModal } from '@/components/content/FillBlanksPreviewModal'
import { ClickableImage } from '@/components/content/MediaPreview'
import { useContentList, useDeleteContent } from '@/hooks/useContent'
import { deleteContent, getDistinctTags } from '@/api/content'
import { useCollections } from '@/hooks/useCollections'
import { toast } from '@/hooks/use-toast'
import type { Content } from '@/types'

// ── Searchable collection picker ──────────────────────────────────────────────

interface CollectionOption { collectionId: string; name: string }

function CollectionSearch({
  collections = [],
  value,
  onChange,
}: {
  collections: CollectionOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen]   = React.useState(false)
  const inputRef           = React.useRef<HTMLInputElement>(null)

  const selected = collections.find((c) => c.collectionId === value)

  const filtered = query.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : collections

  function openDropdown() {
    setOpen(true)
    setQuery('')
    // Focus the search input after the dropdown mounts
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  // Close when the input truly loses focus to something outside the dropdown.
  // The 150 ms delay lets onMouseDown on any dropdown item fire first —
  // if onMouseDown calls select() before the blur settles, setOpen(false) here
  // is a no-op (open is already false).
  function handleInputBlur() {
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      {/* Trigger — always shows the selected name or placeholder */}
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm cursor-pointer text-left"
        onClick={openDropdown}
      >
        <span className={selected ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {selected ? selected.name : 'All collections'}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => { e.stopPropagation(); onChange(''); setQuery('') }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-white shadow-lg">
          {/* Search input lives inside the dropdown so it never competes with the trigger */}
          <div className="border-b px-2 py-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="Search collections…"
              className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* onMouseDown + e.preventDefault() keeps focus on the input so the
                selection fires reliably — click would arrive AFTER blur which
                would unmount the dropdown before the handler could run. */}
            <div
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); select('') }}
            >
              All collections
            </div>

            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No collections found</div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.collectionId}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    c.collectionId === value ? 'bg-accent font-medium' : ''
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); select(c.collectionId) }}
                >
                  {c.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tag multi-select picker ───────────────────────────────────────────────────

function TagSearch({
  allTags,
  value,
  onChange,
}: {
  allTags: string[]
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen]   = React.useState(false)
  const inputRef           = React.useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : allTags

  function openDropdown() {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag))
    } else {
      onChange([...value, tag])
    }
  }

  function handleInputBlur() {
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm cursor-pointer"
        onClick={openDropdown}
      >
        {value.length === 0 ? (
          <span className="text-muted-foreground px-1 py-0.5 flex-1">All tags</span>
        ) : (
          value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {tag}
              <X
                className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer"
                onMouseDown={(e) => { e.stopPropagation(); toggle(tag) }}
              />
            </span>
          ))
        )}
        <div className="flex items-center gap-1 ml-auto shrink-0 self-center">
          {value.length > 0 && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => { e.stopPropagation(); onChange([]) }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border border-input bg-white shadow-lg">
          <div className="border-b px-2 py-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="Search tags…"
              className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {value.length > 0 && (
              <div
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                onMouseDown={(e) => { e.preventDefault(); onChange([]) }}
              >
                Clear selection
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No tags found</div>
            ) : (
              filtered.map((tag) => (
                <div
                  key={tag}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    value.includes(tag) ? 'bg-accent font-medium' : ''
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); toggle(tag) }}
                >
                  <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                    value.includes(tag) ? 'bg-primary border-primary' : 'border-input'
                  }`}>
                    {value.includes(tag) && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  {tag}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const S3_BASE_URL = 'https://all-dev-content-service.s3.ap-south-1.amazonaws.com'

function buildS3Url(prefix: string, filename?: string | null): string | null {
  if (!filename) return null
  if (filename.startsWith('http')) return filename
  const cleanPath = filename.startsWith(prefix) ? filename : `${prefix}/${filename}`
  return `${S3_BASE_URL}/${cleanPath.replace(/^\//, '')}`
}

function resolveAudioUrl(item: Content): string | null {
  const dbAudio = item.contentSourceData?.[0]?.audioUrl
  if (dbAudio?.includes('mechanics')) return buildS3Url('mechanics_audios', dbAudio)
  if (dbAudio?.includes('multilingual')) return buildS3Url('multilingual_audios', dbAudio)
  if (item.language && (item.contentId || item._id)) {
    return `${S3_BASE_URL}/all-audio-files/${item.language}/${item.contentId || item._id}.wav`
  }
  return null
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const CONTENT_TYPES: string[] = ['Word', 'Sentence', 'Paragraph', 'Char']

function ContentTypeCombo({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? CONTENT_TYPES.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : CONTENT_TYPES

  function openDropdown() {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  function handleInputBlur() {
    setTimeout(() => setOpen(false), 150)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      select(query.trim())
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm cursor-pointer text-left"
        onClick={openDropdown}
      >
        <span className={value ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {value || 'All types'}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => { e.stopPropagation(); onChange('') }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-white shadow-lg">
          <div className="border-b px-2 py-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              placeholder="Type or select..."
              className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <div
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); select('') }}
            >
              All types
            </div>
            {filtered.map((t) => (
              <div
                key={t}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                  t === value ? 'bg-accent font-medium' : ''
                }`}
                onMouseDown={(e) => { e.preventDefault(); select(t) }}
              >
                {t}
              </div>
            ))}
            {query.trim() && !filtered.some((t) => t.toLowerCase() === query.trim().toLowerCase()) && (
              <div
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-primary"
                onMouseDown={(e) => { e.preventDefault(); select(query.trim()) }}
              >
                Use "{query.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
// ── Multi-chip input (ContentId / CollectionId) ───────────────────────────────

function MultiChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  function addChips(raw: string) {
    const parts = raw.split(/[,\n\t]+/).map(s => s.trim()).filter(Boolean)
    const newChips = parts.filter(p => !value.includes(p))
    if (newChips.length) onChange([...value, ...newChips])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      addChips(input)
      setInput('')
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (text.includes(',') || text.includes('\n') || text.includes('\t')) {
      e.preventDefault()
      addChips(text)
      setInput('')
    }
  }

  return (
    <div
      className="min-h-9 flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map(chip => (
        <span key={chip} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium font-mono">
          {chip}
          <X
            className="h-3 w-3 cursor-pointer hover:text-destructive"
            onMouseDown={(e) => { e.stopPropagation(); onChange(value.filter(v => v !== chip)) }}
          />
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] outline-none bg-transparent placeholder:text-muted-foreground text-sm"
      />
    </div>
  )
}

// ── Language multi-combo ──────────────────────────────────────────────────────

const LANGUAGES: string[] = ['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma']

function LanguageMultiCombo({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const available = LANGUAGES.filter(l => !value.includes(l))
  const filtered = query.trim()
    ? available.filter(l => l.toLowerCase().includes(query.toLowerCase()))
    : available

  function add(lang: string) {
    if (!value.includes(lang)) onChange([...value, lang])
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(lang: string) {
    if (value.length <= 1) return // must keep at least one
    onChange(value.filter(l => l !== lang))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      add(query.trim())
    } else if (e.key === 'Backspace' && !query && value.length > 1) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleBlur() {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false)
        setQuery('')
      }
    }, 150)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="min-h-9 flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 cursor-text"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        {value.map(lang => (
          <span key={lang} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium">
            {lang}
            {value.length > 1 && (
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onMouseDown={(e) => { e.stopPropagation(); remove(lang) }}
              />
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? 'Select language...' : ''}
          className="flex-1 min-w-[60px] outline-none bg-transparent placeholder:text-muted-foreground text-sm py-0.5"
        />
      </div>
      {open && (filtered.length > 0 || (query.trim() && !LANGUAGES.includes(query.trim()))) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-white shadow-lg">
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(l => (
              <div
                key={l}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => { e.preventDefault(); add(l) }}
              >
                {l}
              </div>
            ))}
            {query.trim() && !LANGUAGES.includes(query.trim()) && !value.includes(query.trim()) && (
              <div
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-primary"
                onMouseDown={(e) => { e.preventDefault(); add(query.trim()) }}
              >
                Add "{query.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
const LIMIT = 20

function reviewStatusVariant(rs: string | undefined): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (!rs) return 'secondary'
  const lower = rs.toLowerCase()
  if (lower === 'approved') return 'success'
  if (lower === 'rejected') return 'destructive'
  return 'warning'
}

export function ContentListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── All filters live in the URL so they survive navigate(-1) from edit page ──
  function getArr(key: string): string[] {
    const v = searchParams.get(key)
    return v ? v.split(',').filter(Boolean) : []
  }

  const languageFilter     = getArr('lang').length > 0 ? getArr('lang') : ['en']
  const typeFilter         = searchParams.get('type')         ?? ''
  const collectionFilter   = searchParams.get('collectionId') ?? ''
  const contentIdFilter    = getArr('contentIds')
  const collectionIdFilter = getArr('collectionIds')
  const textFilter         = searchParams.get('text')         ?? ''
  const tagsFilter         = getArr('tags')
  const page               = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  // Update one or more URL params. Using replace:true so filter tweaks don't
  // clutter browser history — only the navigation to /content/:id/edit is a
  // real history push, which is what navigate(-1) will return to.
  function setFilter(updates: Record<string, string | string[] | number | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
        next.delete(k)
      } else if (Array.isArray(v)) {
        next.set(k, v.join(','))
      } else if (typeof v === 'number') {
        if (v <= 1) next.delete(k); else next.set(k, String(v))
      } else {
        next.set(k, v)
      }
    }
    setSearchParams(next, { replace: true })
  }

  const [showFilters, setShowFilters] = React.useState(false)
  const [deleteTarget,             setDeleteTarget]             = React.useState<Content | null>(null)
  const [previewTarget,            setPreviewTarget]            = React.useState<Content | null>(null)
  const [mcqPreviewTarget,         setMcqPreviewTarget]         = React.useState<Content | null>(null)
  const [m1PreviewTarget,          setM1PreviewTarget]          = React.useState<Content | null>(null)
  const [m2PreviewTarget,          setM2PreviewTarget]          = React.useState<Content | null>(null)
  const [m3PreviewTarget,          setM3PreviewTarget]          = React.useState<Content | null>(null)
  const [fillBlanksPreviewTarget,  setFillBlanksPreviewTarget]  = React.useState<Content | null>(null)
  const [pickerTarget,             setPickerTarget]             = React.useState<Content | null>(null)

  // Debounce only the free-text input for the API call
  const debouncedText = useDebounce(textFilter, 400)

  const { data, isLoading, isError } = useContentList({
    language: languageFilter,
    contentType: typeFilter || undefined,
    collectionId: collectionFilter || undefined,
    limit: LIMIT,
    page,
    searchContentId: contentIdFilter.length ? contentIdFilter : undefined,
    searchCollectionId: collectionIdFilter.length ? collectionIdFilter : undefined,
    searchText: debouncedText.trim() || undefined,
    searchTags: tagsFilter.length ? tagsFilter : undefined,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)

  const { data: collections } = useCollections()
  const { data: allTags = [] } = useQuery({ queryKey: ['content-tags'], queryFn: getDistinctTags, staleTime: 5 * 60_000 })
  const deleteMutation = useDeleteContent()
  const queryClient = useQueryClient()

  // ── Multi-select state ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  // Clear selection when the page or filter results change
  React.useEffect(() => { setSelectedIds(new Set()) }, [items])

  const allOnPageSelected = items.length > 0 && items.every((i) => selectedIds.has(i._id))
  const someOnPageSelected = items.some((i) => selectedIds.has(i._id))

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        items.forEach((i) => next.delete(i._id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        items.forEach((i) => next.add(i._id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const failedIds: string[] = []
    for (const id of ids) {
      try {
        await deleteContent(id)
      } catch {
        failedIds.push(id)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    // Keep only the failed ones selected so the user can see and retry
    setSelectedIds(new Set(failedIds))
    queryClient.invalidateQueries({ queryKey: ['content'] })
    if (failedIds.length > 0) {
      toast({
        title: `${ids.length - failedIds.length} deleted, ${failedIds.length} failed`,
        description: 'Failed items are still selected — you can try deleting them again.',
        variant: 'destructive',
      })
    } else {
      toast({ title: `${ids.length} item${ids.length > 1 ? 's' : ''} deleted`, variant: 'success' })
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <TemplatePickerDialog />
        </div>
      </div>

      {collectionFilter && (
        <div className="bg-muted p-4 rounded-md mb-4 flex justify-between items-center border">
          <span className="font-medium text-sm">
            Filtered by Collection ID:{' '}
            <span className="text-primary font-mono text-xs">{collectionFilter}</span>
          </span>
        </div>
      )}

      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filter Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Language *</Label>
                <LanguageMultiCombo value={languageFilter} onChange={(v) => setFilter({ lang: v, page: null })} />
              </div>
              <div className="space-y-1">
                <Label>Content Type</Label>
                <ContentTypeCombo value={typeFilter} onChange={(v) => setFilter({ type: v, page: null })} />
              </div>
              <div className="space-y-1">
                <Label>Collection</Label>
                <CollectionSearch
                  collections={(collections ?? []).filter((c) => Boolean(c.collectionId))}
                  value={collectionFilter}
                  onChange={(v) => setFilter({ collectionId: v, page: null })}
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="space-y-1">
                <Label>Content ID</Label>
                <MultiChipInput
                  value={contentIdFilter}
                  onChange={(v) => setFilter({ contentIds: v, page: null })}
                  placeholder="Add IDs (Enter or comma)"
                />
              </div>
              <div className="space-y-1">
                <Label>Collection ID</Label>
                <MultiChipInput
                  value={collectionIdFilter}
                  onChange={(v) => setFilter({ collectionIds: v, page: null })}
                  placeholder="Add IDs (Enter or comma)"
                />
              </div>
              <div className="space-y-1">
                <Label>Text Search</Label>
                <Input
                  value={textFilter}
                  onChange={(e) => setFilter({ text: e.target.value, page: null })}
                  placeholder="Search in content text"
                />
              </div>
              <div className="space-y-1">
                <Label>Tags</Label>
                <TagSearch
                  allTags={allTags}
                  value={tagsFilter}
                  onChange={(v) => setFilter({ tags: v, page: null })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">
              Failed to load content. Check your API token and connection.
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No content found.{' '}
              <Link to="/content/new?mode=standard" className="text-primary underline">
                Create one.
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <Checkbox
                      checked={allOnPageSelected}
                      data-state={someOnPageSelected && !allOnPageSelected ? 'indeterminate' : undefined}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead className="min-w-[260px]">Content & Title</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[240px]">Media</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const primarySource = item.contentSourceData?.[0]
                  const imgUrl = buildS3Url('mechanics_images', item.imagePath)
                  const audioUrl = resolveAudioUrl(item)

                  return (
                    <TableRow
                      key={item._id}
                      data-selected={selectedIds.has(item._id)}
                      className={selectedIds.has(item._id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell className="py-4 align-top pr-0 w-10">
                        <Checkbox
                          checked={selectedIds.has(item._id)}
                          onCheckedChange={() => toggleOne(item._id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      {/* ── Title & Content ─────────────────────────────── */}
                      <TableCell className="py-4 align-top">
                        {primarySource?.text && (
                          <p className="text-sm font-medium leading-snug truncate max-w-[250px] mb-0.5">
                            {primarySource.text}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground leading-tight">{item.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <Badge variant="outline" className="text-xs">{item.contentType}</Badge>
                          {item.tags?.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                          {(item.tags?.length ?? 0) > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{item.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* ── Language ─────────────────────────────────────── */}
                      <TableCell className="py-4 align-top">
                        <Badge variant="secondary">{item.language}</Badge>
                      </TableCell>

                      {/* ── Status (publish + review) ─────────────────────── */}
                      <TableCell className="py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <Badge variant={item.status === 'live' ? 'success' : 'warning'}>
                            {item.status}
                          </Badge>
                          {item.reviewStatus && (
                            <Badge variant={reviewStatusVariant(item.reviewStatus)}>
                              {item.reviewStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* ── Media ────────────────────────────────────────── */}
                      <TableCell className="py-4 align-top">
                        <div className="flex items-center gap-3">
                          {imgUrl && (
                            <ClickableImage
                              src={imgUrl}
                              alt="thumbnail"
                              className="h-10 w-10 rounded-md object-cover border flex-shrink-0"
                              showMagnifyIcon={false}
                            />
                          )}
                          {audioUrl && (
                            <audio
                              controls
                              src={audioUrl}
                              className="h-8 w-[200px]"
                              onError={(e) => (e.currentTarget.style.opacity = '0.5')}
                            />
                          )}
                          {!imgUrl && !audioUrl && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* ── Updated ──────────────────────────────────────── */}
                      <TableCell className="py-4 align-top text-muted-foreground text-xs">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}
                      </TableCell>

                      {/* ── Actions ──────────────────────────────────────── */}
                      <TableCell className="py-4 align-top">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Preview"
                            onClick={() => {
                              const hasMechanic1 = item.mechanics_data?.some((m) => m.mechanics_id === 'mechanic_1')
                              const hasMcq = item.mechanics_data?.some((m) => m.mechanics_id === 'mechanic_2')
                              const hasM1L = item.mechanics_data?.some((m) => m.mechanics_id === 'M1_L')
                              const hasM2L = item.mechanics_data?.some((m) => m.mechanics_id === 'M2_L')
                              const hasM3L = item.mechanics_data?.some((m) => m.mechanics_id === 'M3_L')
                              if (hasMechanic1 || hasMcq || hasM1L || hasM2L || hasM3L) setPickerTarget(item)
                              else setPreviewTarget(item)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/content/${item._id}/edit`, { state: { content: item } })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <strong>{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)}</strong>
            {' '}of <strong>{total}</strong> items
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setFilter({ page: page - 1 })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {buildPageNumbers(page, totalPages).map((n, i) =>
                n === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button
                    key={n}
                    variant={n === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setFilter({ page: n as number })}
                  >
                    {n}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setFilter({ page: page + 1 })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Preview type picker — shown when content has multiple preview types */}
      <Dialog open={!!pickerTarget} onOpenChange={(o) => !o && setPickerTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Preview</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setPreviewTarget(pickerTarget); setPickerTarget(null) }}
              className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
            >
              <BookOpen className="h-6 w-6 text-[#5BC8F5]" />
              Read Along
            </button>
            {pickerTarget?.mechanics_data?.some((m) => m.mechanics_id === 'mechanic_1') && (
              <button
                type="button"
                onClick={() => { setFillBlanksPreviewTarget(pickerTarget); setPickerTarget(null) }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
              >
                <ListChecks className="h-6 w-6 text-[#6D28D9]" />
                Fill in the Blanks
              </button>
            )}
            {pickerTarget?.mechanics_data?.some((m) => m.mechanics_id === 'M1_L') && (
              <button
                type="button"
                onClick={() => { setM1PreviewTarget(pickerTarget); setPickerTarget(null) }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
              >
                <BookOpen className="h-6 w-6 text-[#1D4ED8]" />
                M1 Mechanic
              </button>
            )}
            {pickerTarget?.mechanics_data?.some((m) => m.mechanics_id === 'M2_L') && (
              <button
                type="button"
                onClick={() => { setM2PreviewTarget(pickerTarget); setPickerTarget(null) }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
              >
                <ListChecks className="h-6 w-6 text-[#DB2777]" />
                M2 Bingo
              </button>
            )}
            {pickerTarget?.mechanics_data?.some((m) => m.mechanics_id === 'M3_L') && (
              <button
                type="button"
                onClick={() => { setM3PreviewTarget(pickerTarget); setPickerTarget(null) }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
              >
                <ListChecks className="h-6 w-6 text-[#0F766E]" />
                M3 Sentence MCQ
              </button>
            )}
            {pickerTarget?.mechanics_data?.some((m) => m.mechanics_id === 'mechanic_2') && (
              <button
                type="button"
                onClick={() => { setMcqPreviewTarget(pickerTarget); setPickerTarget(null) }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:border-primary/50 transition-colors text-sm font-medium"
              >
                <ListChecks className="h-6 w-6 text-[#7C3AED]" />
                MCQ
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReadAlongPreviewModal
        content={previewTarget}
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <MCQPreviewModal
        content={mcqPreviewTarget}
        open={!!mcqPreviewTarget}
        onClose={() => setMcqPreviewTarget(null)}
      />

      <M1PreviewModal
        content={m1PreviewTarget}
        open={!!m1PreviewTarget}
        onClose={() => setM1PreviewTarget(null)}
      />

      <M2PreviewModal
        content={m2PreviewTarget}
        open={!!m2PreviewTarget}
        onClose={() => setM2PreviewTarget(null)}
      />

      <M3PreviewModal
        content={m3PreviewTarget}
        open={!!m3PreviewTarget}
        onClose={() => setM3PreviewTarget(null)}
      />

      <FillBlanksPreviewModal
        content={fillBlanksPreviewTarget}
        open={!!fillBlanksPreviewTarget}
        onClose={() => setFillBlanksPreviewTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Content"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}?`}
        description={`This will permanently delete ${selectedIds.size} selected item${selectedIds.size > 1 ? 's' : ''}. This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        confirmLabel={`Delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}`}
      />
    </div>
  )
}
