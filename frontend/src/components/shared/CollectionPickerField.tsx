import * as React from 'react'
import { Search, Plus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/shared/TagInput'
import { useCollections, useCreateCollection } from '@/hooks/useCollections'

interface Props {
  value: string                  // selected collectionId ('' = none)
  onChange: (id: string) => void
  defaultLanguage?: string       // pre-fill for new collection dialog
  defaultContentType?: string    // pre-fill for new collection dialog (category)
}

export function CollectionPickerField({ value, onChange, defaultLanguage = 'en', defaultContentType = 'Word' }: Props) {
  const { data: collections = [] } = useCollections()
  const createMutation = useCreateCollection()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [query,       setQuery]       = React.useState('')
  const [open,        setOpen]        = React.useState(false)
  const [createOpen,  setCreateOpen]  = React.useState(false)

  // New collection form state
  const [newName,     setNewName]     = React.useState('')
  const [newTags,     setNewTags]     = React.useState<string[]>([])
  const [newLanguage, setNewLanguage] = React.useState(defaultLanguage)
  const [newCategory, setNewCategory] = React.useState(defaultContentType)
  const [nameError,   setNameError]   = React.useState('')
  const [tagsError,   setTagsError]   = React.useState('')

  // Keep pre-fill in sync if parent language/contentType changes
  React.useEffect(() => { setNewLanguage(defaultLanguage) },   [defaultLanguage])
  React.useEffect(() => { setNewCategory(defaultContentType) }, [defaultContentType])

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedCollection = collections.find((c: any) => c.collectionId === value)

  const filtered = query.trim()
    ? collections.filter((c: any) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : collections

  function handleSelect(collectionId: string) {
    onChange(collectionId)
    setQuery('')
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  async function handleCreate() {
    setNameError('')
    setTagsError('')
    if (!newName.trim()) { setNameError('Name is required'); return }
    if (newTags.length === 0) { setTagsError('At least one tag is required'); return }

    const created: any = await createMutation.mutateAsync({
      name:     newName.trim(),
      category: newCategory as any,
      language: newLanguage as any,
      status:   'live' as any,
      tags:     newTags,
    })

    if (created?.collectionId) {
      onChange(created.collectionId)
    }

    setCreateOpen(false)
    setNewName('')
    setNewTags([])
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* ── Trigger ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm cursor-text"
          onClick={() => { setOpen(true); }}
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {open ? (
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search collections…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`flex-1 truncate ${!selectedCollection ? 'text-muted-foreground' : ''}`}>
              {selectedCollection ? selectedCollection.name : 'Search or create collection…'}
            </span>
          )}
          {selectedCollection && !open && (
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Dropdown ────────────────────────────────────────────────── */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover bg-white shadow-md">
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No collections found.</p>
              )}
              {filtered.map((c: any) => (
                <button
                  key={c.collectionId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(c.collectionId) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  {value === c.collectionId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className={value === c.collectionId ? 'ml-0' : 'ml-5'}>{c.name}</span>
                </button>
              ))}
            </div>

            {/* Create new option */}
            <div className="border-t p-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  setCreateOpen(true)
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-primary hover:bg-accent font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new collection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Collection Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-coll-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="new-coll-name"
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={newLanguage} onValueChange={setNewLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
                      { code: 'ta', label: 'Tamil' },   { code: 'te', label: 'Telugu' },
                      { code: 'kn', label: 'Kannada' }, { code: 'gu', label: 'Gujarati' },
                      { code: 'ma', label: 'Marathi' },
                    ].map(({ code, label }) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Word', 'Sentence', 'Paragraph', 'Char'].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags <span className="text-destructive">*</span></Label>
              <TagInput value={newTags} onChange={setNewTags} placeholder="Type a tag and press Enter" />
              {tagsError && <p className="text-xs text-destructive">{tagsError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
