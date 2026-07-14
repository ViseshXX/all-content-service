import * as React from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { AssetUploadField, hasPendingAssetChanges, flushPendingUploads } from '@/components/content/AssetUploadField'
import { toast } from '@/hooks/use-toast'
import { useMultilingualEntry, useUpdateMultilingual } from '@/hooks/useMultilingual'
import type { MultilingualEntry, MultilingualLangData } from '@/types'
import type { ReactNode } from 'react'

const LANG_NAMES: Record<string, string> = {
  hi: 'Hindi',
  te: 'Telugu',
  kn: 'Kannada',
  ta: 'Tamil',
  gu: 'Gujarati',
  ma: 'Marathi',
  en: 'English',
}

// Form value shape: one key per language
type LangFormValue = { text: string; audio_url: string; image_url: string }
type FormValues = { languages: Record<string, LangFormValue> }

// ── Change tracking ────────────────────────────────────────────────────────────

type ChangeEntry = { label: string; from?: string; to?: string }

function buildChanges(
  dirtyFields: Partial<Record<string, any>>,
  langs: string[],
  original: Record<string, LangFormValue>,
  updated: Record<string, LangFormValue>,
): ChangeEntry[] {
  const out: ChangeEntry[] = []
  for (const lang of langs) {
    const df = (dirtyFields as any).languages?.[lang] ?? {}
    const origLang = original[lang] ?? { text: '', audio_url: '', image_url: '' }
    const updLang  = updated[lang]  ?? { text: '', audio_url: '', image_url: '' }
    if (df.text)      out.push({ label: `${LANG_NAMES[lang] ?? lang} — Text`,      from: origLang.text,      to: updLang.text })
    if (df.audio_url) out.push({ label: `${LANG_NAMES[lang] ?? lang} — Audio URL`, from: origLang.audio_url, to: updLang.audio_url })
    if (df.image_url) out.push({ label: `${LANG_NAMES[lang] ?? lang} — Image URL`, from: origLang.image_url, to: updLang.image_url })
  }
  return out
}

function ChangeSummary({ changes }: { changes: ChangeEntry[] }): ReactNode {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">The following fields will be updated:</p>
      <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {changes.map((c, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{c.label}</span>
            {c.from !== undefined && (
              <span className="ml-1.5 text-muted-foreground">
                <span className="line-through">{c.from || '—'}</span>
                <span className="mx-1">→</span>
                <span className="text-foreground font-medium">{c.to || '—'}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function dirty(isDirty: boolean) {
  return isDirty ? 'border-l-2 border-red-400 pl-2 bg-red-100 rounded-sm' : ''
}

// ── Inner form (once data is loaded) ──────────────────────────────────────────

function MultilingualEditForm({
  entry,
  onSaved,
}: {
  entry: MultilingualEntry
  onSaved: () => void
}) {
  const navigate = useNavigate()
  const updateMutation = useUpdateMultilingual()

  // Derive language list (exclude content_id key)
  const langs = Object.keys(entry.multilingual ?? {}).filter((k) => k !== 'content_id')

  // Build defaultValues
  const defaultLanguages = Object.fromEntries(
    langs.map((lang) => {
      const d = entry.multilingual[lang] as MultilingualLangData | undefined
      return [lang, { text: d?.text ?? '', audio_url: d?.audio_url ?? '', image_url: d?.image_url ?? '' }]
    }),
  )

  const { register, control, handleSubmit, watch, getValues, formState: { dirtyFields, isDirty } } =
    useForm<FormValues>({ defaultValues: { languages: defaultLanguages } })

  const [confirmOpen,   setConfirmOpen]   = React.useState(false)
  const [pendingData,   setPendingData]   = React.useState<Record<string, LangFormValue> | null>(null)
  const [changeList,    setChangeList]    = React.useState<ChangeEntry[]>([])

  const watchedLangs = watch('languages')
  const df = dirtyFields as any

  async function handleFormSubmit(data: FormValues) {
    if (hasPendingAssetChanges()) {
      toast({ title: 'Unsaved asset changes', description: 'One or more filenames were changed but no file was uploaded. Please upload before saving.', variant: 'destructive' })
      return
    }
    try {
      await flushPendingUploads()
      data = getValues()
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.response?.data?.message ?? err?.message ?? 'File upload failed. Please try again.', variant: 'destructive' })
      return
    }
    if (isDirty) {
      const changes = buildChanges(dirtyFields, langs, defaultLanguages, data.languages)
      if (changes.length === 0) {
        await save(data.languages)
        return
      }
      setChangeList(changes)
      setPendingData(data.languages)
      setConfirmOpen(true)
      return
    }
    await save(data.languages)
  }

  async function save(langValues: Record<string, LangFormValue>) {
    // Build the multilingual object to update
    const updated: Record<string, MultilingualLangData> = {}
    for (const lang of langs) {
      updated[lang] = {
        text:      langValues[lang]?.text ?? '',
        audio_url: langValues[lang]?.audio_url ?? '',
        image_url: langValues[lang]?.image_url ?? '',
      }
    }
    // Preserve content_id if present
    const multilingualPayload: any = { ...updated }
    if (entry.multilingual.content_id) {
      multilingualPayload.content_id = entry.multilingual.content_id
    }

    updateMutation.mutate(
      { id: entry._id, payload: { multilingual: multilingualPayload } },
      { onSuccess: onSaved },
    )
  }

  async function handleConfirm() {
    if (!pendingData) return
    setConfirmOpen(false)
    await save(pendingData)
    setPendingData(null)
  }

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Header info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-mono">{entry.multilingual_id}</span>
              {entry.multilingual.content_id && (
                <Badge variant="outline" className="text-xs font-normal">
                  content_id: {entry.multilingual.content_id}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Per-language cards */}
        {langs.map((lang) => {
          const langDirty = df.languages?.[lang] ?? {}
          const watched   = watchedLangs?.[lang] ?? {}
          return (
            <Card key={lang}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {LANG_NAMES[lang] ?? lang}{' '}
                  <span className="text-sm font-mono text-muted-foreground">({lang})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`space-y-1 ${dirty(!!langDirty.text)}`}>
                  <Label>Text</Label>
                  <Input {...register(`languages.${lang}.text`)} />
                </div>

                <div className={`space-y-1 ${dirty(!!langDirty.audio_url)}`}>
                  <Label>Audio</Label>
                  <Controller
                    control={control}
                    name={`languages.${lang}.audio_url`}
                    render={({ field }) => (
                      <AssetUploadField
                        assetType="audio"
                        value={field.value}
                        onChange={field.onChange}
                        language={lang}
                        audioType="multilingual"
                        audioFolder="multilingual_audios"
                        fieldName={field.name}
                      />
                    )}
                  />
                </div>

                <div className={`space-y-1 ${dirty(!!langDirty.image_url)}`}>
                  <Label>Image</Label>
                  <Controller
                    control={control}
                    name={`languages.${lang}.image_url`}
                    render={({ field }) => (
                      <AssetUploadField
                        assetType="image"
                        value={field.value}
                        onChange={field.onChange}
                        fieldName={field.name}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}

        <Separator />

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/multilingual')}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) { setConfirmOpen(false); setPendingData(null) }
        }}
        title="Confirm Changes"
        description={<ChangeSummary changes={changeList} />}
        onConfirm={handleConfirm}
        loading={updateMutation.isPending}
        confirmLabel="Save Changes"
        confirmVariant="default"
      />
    </>
  )
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

export function EditMultilingualPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  // Prefer location state to avoid an extra fetch when navigating from the list
  const locationEntry = (location.state as { entry?: MultilingualEntry } | null)?.entry
  const { data: fetchedEntry, isLoading, isError } = useMultilingualEntry(
    locationEntry ? '' : (id ?? ''),
  )
  const entry = locationEntry ?? fetchedEntry

  if (!entry && isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }
  if (!entry && isError) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load entry. Check your API token and connection.
      </div>
    )
  }
  if (!entry) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/multilingual')}>
          ← Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Multilingual Entry</h1>
      </div>
      <MultilingualEditForm
        key={entry._id}
        entry={entry}
        onSaved={() => navigate('/multilingual')}
      />
    </div>
  )
}
