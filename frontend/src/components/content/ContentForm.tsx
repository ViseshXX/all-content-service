import * as React from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TagInput } from '@/components/shared/TagInput'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ContentSourceDataField } from './ContentSourceDataField'
import { LevelComplexityField } from './LevelComplexityField'
import { MechanicsDataSection } from './MechanicsDataSection'
import { MultilingualField } from './MultilingualField'
import { CollectionPickerField } from '@/components/shared/CollectionPickerField'
import { ImagePreview } from './MediaPreview'
import { AssetUploadField, hasPendingAssetChanges, flushPendingUploads } from './AssetUploadField'
import { ReadAlongPreviewModal } from './ReadAlongPreviewModal'
import { Eye, ArrowLeft } from 'lucide-react'
import { validateMultilingualWords } from '@/api/multilingual'
import { toast } from '@/hooks/use-toast'
import type { Content } from '@/types'

const contentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contentType: z.enum(['Word', 'Sentence', 'Paragraph', 'Char']),
  language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma', 'or']),
  status: z.enum(['live', 'draft']),
  collectionId: z.string().optional(),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  imagePath: z.string().optional(),
  contentIndex: z.number().optional(),
  publisher: z.string().optional(),
  level_complexity: z
    .object({
      level: z.string().optional(),
      level_competency: z.string().optional(),
      CEFR_level: z.string().optional(),
    })
    .optional(),
  contentSourceData: z.array(
    z.object({
      language: z.string(),
      text: z.string().min(1, 'Text is required'),
      audioUrl: z.string().optional(),
      inst_audioUrl: z.string().optional(),
      // allow pass-through of computed/reference fields
      multilingual_id: z.array(z.string()).optional(),
      phonemes: z.array(z.string()).optional(),
      wordCount: z.number().optional(),
      syllableCount: z.number().optional(),
    })
  ).min(1, 'At least one content source entry is required'),
  mechanics_data: z.array(z.any()).optional(),
  multilingual: z.record(z.object({ text: z.string(), audio_url: z.string().optional() })).optional(),
})

export type ContentFormValues = z.infer<typeof contentFormSchema>

// ── Change tracking helpers ────────────────────────────────────────────────

const MECH_LABELS: Record<string, string> = {
  mechanic_1:  'Fill in the Blanks',
  mechanic_2:  'MCQ',
  mechanic_3:  'Jumbled',
  M1_L:        'M1 — Syllable Breakdown',
  M2_L:        'M2 — Word-Image Match',
  M3_L:        'M3 — Sentence-Image MCQ',
  mechanic_14: 'M10-M15 — Announcement Flow',
}

type ChangeEntry = { label: string; from?: string; to?: string }

function mechLabel(id: string) {
  return MECH_LABELS[id] ? `${MECH_LABELS[id]} (${id})` : (id || 'Unknown')
}

/**
 * Compares two full form snapshots and returns only fields that actually changed.
 * Does NOT rely on RHF dirtyFields, which gives false positives when setValue is
 * called programmatically (e.g. language sync, correctness auto-compute).
 */
function buildChanges(initial: ContentFormValues, updated: ContentFormValues): ChangeEntry[] {
  const out: ChangeEntry[] = []
  function str(v: unknown) { return String(v ?? '') }

  // Simple scalar fields
  const scalarFields: Array<[keyof ContentFormValues, string]> = [
    ['name',         'Name'],
    ['contentType',  'Content Type'],
    ['language',     'Language'],
    ['status',       'Status'],
    ['publisher',    'Publisher'],
    ['imagePath',    'Image Path'],
    ['contentIndex', 'Content Index'],
    ['collectionId', 'Collection'],
  ]
  for (const [field, label] of scalarFields) {
    const a = str((initial as any)[field])
    const b = str((updated as any)[field])
    if (a !== b) out.push({ label, from: a || '—', to: b || '—' })
  }

  // Tags
  const tagsA = (initial.tags ?? []).join(', ')
  const tagsB = (updated.tags ?? []).join(', ')
  if (tagsA !== tagsB) out.push({ label: 'Tags', from: tagsA || '—', to: tagsB || '—' })

  // Level & Complexity
  const lcFields: Array<[keyof NonNullable<ContentFormValues['level_complexity']>, string]> = [
    ['level',            'Level'],
    ['level_competency', 'Level Competency'],
    ['CEFR_level',       'CEFR Level'],
  ]
  for (const [k, label] of lcFields) {
    const a = str(initial.level_complexity?.[k])
    const b = str(updated.level_complexity?.[k])
    if (a !== b) out.push({ label: `Level & Complexity — ${label}`, from: a || '—', to: b || '—' })
  }

  // Read Along (contentSourceData) — only user-editable fields
  const srcFields: Array<[string, string]> = [
    ['text',          'Text'],
    ['audioUrl',      'Audio URL'],
    ['inst_audioUrl', 'Instruction Audio URL'],
  ]
  ;(updated.contentSourceData ?? []).forEach((entry, i) => {
    const orig = (initial.contentSourceData ?? [])[i] ?? {}
    const lang = entry.language || `entry ${i + 1}`
    for (const [k, label] of srcFields) {
      const a = str((orig as any)[k])
      const b = str((entry as any)[k])
      if (a !== b) out.push({ label: `Read Along [${lang}] — ${label}`, from: a || '—', to: b || '—' })
    }
    const mlA = ((orig as any).multilingual_id ?? []).join(', ')
    const mlB = ((entry as any).multilingual_id ?? []).join(', ')
    if (mlA !== mlB) out.push({ label: `Read Along [${lang}] — Multilingual Words`, from: mlA || '—', to: mlB || '—' })
  })

  // Multilingual
  const mlA = initial.multilingual ?? {}
  const mlB = updated.multilingual ?? {}
  const mlLangs = new Set([...Object.keys(mlA), ...Object.keys(mlB)])
  for (const lang of mlLangs) {
    const a = mlA[lang]
    const b = mlB[lang]
    if (!a && b)  { out.push({ label: `Multilingual [${lang.toUpperCase()}] — Added` }); continue }
    if (a && !b)  { out.push({ label: `Multilingual [${lang.toUpperCase()}] — Removed` }); continue }
    if (a && b) {
      if (a.text !== b.text)
        out.push({ label: `Multilingual [${lang.toUpperCase()}] — Text`, from: a.text || '—', to: b.text || '—' })
      if (str(a.audio_url) !== str(b.audio_url))
        out.push({ label: `Multilingual [${lang.toUpperCase()}] — Audio URL`, from: a.audio_url || '—', to: b.audio_url || '—' })
    }
  }

  // Mechanics data — keyed by mechanics_id for stable matching
  const mechInitial: Record<string, any> = {}
  for (const m of (initial.mechanics_data ?? []) as any[]) {
    if (m.mechanics_id) mechInitial[m.mechanics_id] = m
  }

  const mechUpdated: Record<string, any> = {}
  for (const m of (updated.mechanics_data ?? []) as any[]) {
    if (m.mechanics_id) mechUpdated[m.mechanics_id] = m
  }

  // Removed entries
  for (const id of Object.keys(mechInitial)) {
    if (!mechUpdated[id]) out.push({ label: `Mechanics — ${mechLabel(id)}: Removed` })
  }

  // Added or modified entries
  for (const [id, mech] of Object.entries(mechUpdated)) {
    const orig = mechInitial[id]
    if (!orig) { out.push({ label: `Mechanics — ${mechLabel(id)}: Added` }); continue }

    const lbl = mechLabel(id)
    const mechScalars: Array<[string, string]> = [
      ['text',        'Text'],
      ['audio_url',   'Audio URL'],
      ['image_url',   'Image URL'],
      ['jumbled_text','Jumbled Text'],
      ['time_limit',  'Time Limit'],
    ]
    for (const [k, fieldLabel] of mechScalars) {
      const a = str(orig[k])
      const b = str(mech[k])
      if (a !== b) out.push({ label: `Mechanics — ${lbl} — ${fieldLabel}`, from: a || '—', to: b || '—' })
    }

    if (JSON.stringify(orig.options        ?? []) !== JSON.stringify(mech.options        ?? []))
      out.push({ label: `Mechanics — ${lbl} — Options: modified` })
    if (JSON.stringify(orig.syllable       ?? []) !== JSON.stringify(mech.syllable       ?? []))
      out.push({ label: `Mechanics — ${lbl} — Syllable Breakdown: modified` })
    if (JSON.stringify(orig.imageAudioMap  ?? []) !== JSON.stringify(mech.imageAudioMap  ?? []))
      out.push({ label: `Mechanics — ${lbl} — Image-Audio Map: modified` })
    if (JSON.stringify(orig.words          ?? []) !== JSON.stringify(mech.words          ?? []))
      out.push({ label: `Mechanics — ${lbl} — Words: modified` })
    if (JSON.stringify(orig.correctness    ?? {}) !== JSON.stringify(mech.correctness    ?? {}))
      out.push({ label: `Mechanics — ${lbl} — Correctness: modified` })
    if (JSON.stringify(orig.hints          ?? {}) !== JSON.stringify(mech.hints          ?? {}))
      out.push({ label: `Mechanics — ${lbl} — Hints: modified` })
  }

  return out
}

function ChangeSummary({ changes }: { changes: ChangeEntry[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">The following fields will be updated:</p>
      <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {changes.map((c, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{c.label}</span>
            {c.from !== undefined && (
              <span className="ml-1.5 text-muted-foreground">
                <span className="line-through">{c.from}</span>
                <span className="mx-1">→</span>
                <span className="text-foreground font-medium">{c.to}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Returns a highlight class when the field is dirty (edit mode only)
function dirty(isDirty: boolean, isEditMode: boolean) {
  return isEditMode && isDirty
    ? 'border-l-2 border-red-400 pl-2 bg-red-100 rounded-sm'
    : ''
}

// ── Component ──────────────────────────────────────────────────────────────

interface ContentFormProps {
  mode: 'standard' | 'mechanics'
  defaultValues?: Partial<Content>
  onSubmit: (data: ContentFormValues) => Promise<void>
  isSubmitting?: boolean
}

export function ContentForm({ mode, defaultValues, onSubmit, isSubmitting }: ContentFormProps) {
  const navigate   = useNavigate()
  const isEditMode = !!defaultValues

  const [confirmOpen,   setConfirmOpen]   = React.useState(false)
  const [pendingSubmit, setPendingSubmit] = React.useState<ContentFormValues | null>(null)
  const [changeList,    setChangeList]    = React.useState<ChangeEntry[]>([])
  const [previewOpen,   setPreviewOpen]   = React.useState(false)
  const [leaveOpen,     setLeaveOpen]     = React.useState(false)

  // Snapshot of form values at mount — used for accurate change detection.
  // Captured after all mount effects run so it reflects the fully-initialised state.
  const initialValuesRef = React.useRef<ContentFormValues | null>(null)

  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      contentType: defaultValues?.contentType ?? 'Word',
      language: defaultValues?.language ?? 'en',
      status: defaultValues?.status ?? 'draft',
      collectionId: defaultValues?.collectionId ?? '',
      tags: defaultValues?.tags ?? [],
      imagePath: defaultValues?.imagePath ?? '',
      contentIndex: defaultValues?.contentIndex,
      publisher: defaultValues?.publisher ?? '',
      level_complexity: defaultValues?.level_complexity ?? { level: '', level_competency: '', CEFR_level: '' },
      contentSourceData: defaultValues?.contentSourceData?.map((sd) => ({
        language: sd.language,
        text: sd.text,
        audioUrl: sd.audioUrl ?? '',
        inst_audioUrl: sd.inst_audioUrl ?? '',
        multilingual_id: (sd as any).multilingual_id,
        phonemes: sd.phonemes,
        wordCount: sd.wordCount,
        syllableCount: sd.syllableCount,
      })) ?? [{ language: 'en', text: '', audioUrl: '', inst_audioUrl: '' }],
      mechanics_data: defaultValues?.mechanics_data ?? [],
      multilingual: defaultValues?.multilingual,
    },
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = form

  const tags              = watch('tags')
  const imagePath         = watch('imagePath')
  const watchedSourceData = watch('contentSourceData')
  const watchedType       = watch('contentType')
  const watchedLang       = watch('language')

  // Sync contentSourceData[0].language whenever Basic Information language changes.
  // Only acts when there is an actual mismatch — safe against Strict Mode double-invocation.
  React.useEffect(() => {
    if (!watchedLang) return
    const current = form.getValues('contentSourceData.0.language')
    if (current === watchedLang) return  // already in sync, nothing to do
    setValue('contentSourceData.0.language', watchedLang, { shouldDirty: true })
    if (isEditMode) {
      toast({ title: 'Read-along language synced', description: `Language updated to "${watchedLang}".` })
    }
  }, [watchedLang]) // eslint-disable-line react-hooks/exhaustive-deps

  // Capture snapshot AFTER all mount effects have run (language sync included).
  // This is the baseline we diff against — avoids false positives from programmatic setValue calls.
  React.useEffect(() => {
    initialValuesRef.current = JSON.parse(JSON.stringify(form.getValues()))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function hasUnsavedChanges() {
    if (!isEditMode || !initialValuesRef.current) return false
    return buildChanges(initialValuesRef.current, form.getValues()).length > 0
  }

  // Warn on browser refresh / tab close when there are unsaved changes.
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedChanges()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }) // no deps — always re-registers so it reads latest form state

  function handleLeave() {
    if (hasUnsavedChanges()) {
      setLeaveOpen(true)
    } else {
      navigate(-1)
    }
  }

  async function handleFormSubmit(data: ContentFormValues) {
    // Block save if any audio/image filename was edited but not uploaded/generated
    if (hasPendingAssetChanges()) {
      toast({
        title: 'Unsaved asset changes',
        description: 'One or more audio/image filenames were changed but no file was uploaded or generated. Please upload or use Generate TTS before saving.',
        variant: 'destructive',
      })
      return
    }

    // Upload any staged files before saving
    try {
      await flushPendingUploads()
      // Re-read form values after uploads update RHF state
      data = form.getValues()
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err?.response?.data?.message ?? err?.message ?? 'File upload failed. Please try again.',
        variant: 'destructive',
      })
      return
    }

    // Clean up empty optional fields
    const cleaned = { ...data }
    if (!cleaned.collectionId) delete cleaned.collectionId
    if (!cleaned.imagePath)    delete cleaned.imagePath
    if (!cleaned.publisher)    delete cleaned.publisher
    if (Number.isNaN(cleaned.contentIndex)) delete cleaned.contentIndex
    if (cleaned.level_complexity &&
        !cleaned.level_complexity.level &&
        !cleaned.level_complexity.level_competency &&
        !cleaned.level_complexity.CEFR_level) {
      delete cleaned.level_complexity
    }
    cleaned.contentSourceData = cleaned.contentSourceData.map(({ language, text, audioUrl, inst_audioUrl, multilingual_id }) => ({
      language,
      text,
      ...(audioUrl        ? { audioUrl }        : {}),
      ...(inst_audioUrl   ? { inst_audioUrl }   : {}),
      ...(multilingual_id ? { multilingual_id } : {}),
    }))
    if (mode === 'standard') delete cleaned.mechanics_data
    if (!cleaned.multilingual && defaultValues?.multilingual) {
      cleaned.multilingual = defaultValues.multilingual
    }

    // Validate: every multilingual entry must have non-empty text and audio
    if (cleaned.multilingual) {
      const emptyText = Object.entries(cleaned.multilingual)
        .filter(([, v]) => !v.text?.trim())
        .map(([lang]) => lang.toUpperCase())
      if (emptyText.length > 0) {
        toast({
          title: 'Multilingual text required',
          description: `Text is empty for: ${emptyText.join(', ')}. Please fill in the text or remove the entry.`,
          variant: 'destructive',
        })
        return
      }
      const emptyAudio = Object.entries(cleaned.multilingual)
        .filter(([, v]) => !v.audio_url?.trim())
        .map(([lang]) => lang.toUpperCase())
      if (emptyAudio.length > 0) {
        toast({
          title: 'Multilingual audio required',
          description: `Audio is missing for: ${emptyAudio.join(', ')}. Please upload or generate TTS before saving.`,
          variant: 'destructive',
        })
        return
      }
    }

    // Validate: if content originally had multilingual data, at least 1 entry must remain
    if (defaultValues?.multilingual && Object.keys(defaultValues.multilingual).length > 0) {
      const currentMultilingual = cleaned.multilingual ?? {}
      if (Object.keys(currentMultilingual).length === 0) {
        toast({
          title: 'Multilingual data required',
          description: 'At least one multilingual language entry is required.',
          variant: 'destructive',
        })
        return
      }
    }

    // Validate multilingual_id words against the collection
    for (const entry of cleaned.contentSourceData) {
      const words = (entry as any).multilingual_id as string[] | undefined
      if (!words) continue
      if (words.length === 0) {
        toast({ title: 'Multilingual words required', description: 'At least 1 multilingual word is required.', variant: 'destructive' })
        return
      }
      const missing = await validateMultilingualWords(words)
      if (missing.length > 0) {
        toast({
          title: 'Multilingual word(s) not found',
          description: `Not in multilingual collection: ${missing.join(', ')}`,
          variant: 'destructive',
        })
        return
      }
    }

    // Validate options for M3_L, mechanic_1, mechanic_2
    for (const mech of (cleaned.mechanics_data ?? []) as any[]) {
      const mid: string = mech.mechanics_id
      if (['M3_L', 'mechanic_1', 'mechanic_2'].includes(mid)) {
        const opts = (mech.options ?? []) as any[]

        // Min 2 options
        if (['mechanic_1', 'mechanic_2'].includes(mid) && opts.length < 2) {
          toast({
            title: 'Not enough options',
            description: `${mid === 'mechanic_1' ? 'Fill in the Blanks' : 'MCQ'} requires at least 2 options.`,
            variant: 'destructive',
          })
          return
        }

        // At least 1 correct answer
        const hasCorrect = opts.some((o: any) => o.isAns === true)
        if (!hasCorrect) {
          const label = mid === 'mechanic_1' ? 'Fill in the Blanks' : mid === 'mechanic_2' ? 'MCQ' : 'M3'
          toast({
            title: 'No correct answer selected',
            description: `At least one option must be marked as the correct answer for ${label}.`,
            variant: 'destructive',
          })
          return
        }

        // mechanic_2: each option must have audio_url
        if (mid === 'mechanic_2') {
          const missingAudio = opts.some((o: any) => !o.audio_url?.trim())
          if (missingAudio) {
            toast({
              title: 'Option audio required',
              description: 'Every MCQ option must have an audio URL.',
              variant: 'destructive',
            })
            return
          }

          // Correctness (50%) must not be empty
          const correctness = (mech.correctness?.['50%'] ?? []) as any[]
          if (correctness.length === 0) {
            toast({
              title: 'Correctness required',
              description: 'The Correctness (50%) field must have at least one entry for MCQ.',
              variant: 'destructive',
            })
            return
          }
        }
      }
    }

    // Validate M1_L syllable breakdowns — each entry must have text AND audio_url
    for (const mech of (cleaned.mechanics_data ?? []) as any[]) {
      if (mech.mechanics_id === 'M1_L') {
        const hasIncomplete = (mech.syllable ?? []).some(
          (s: any) => !s.text?.trim() || !s.audio_url?.trim(),
        )
        if (hasIncomplete) {
          toast({
            title: 'Syllable breakdown incomplete',
            description: 'Each syllable entry must have both text and audio URL filled in.',
            variant: 'destructive',
          })
          return
        }
      }
    }

    // Validate: no duplicate mechanic_1 / mechanic_2 / mechanic_3 entries
    const m4m9Counts: Record<string, number> = {}
    for (const mech of (cleaned.mechanics_data ?? []) as any[]) {
      const mid: string = mech.mechanics_id
      if (['mechanic_1', 'mechanic_2', 'mechanic_3'].includes(mid)) {
        m4m9Counts[mid] = (m4m9Counts[mid] ?? 0) + 1
      }
    }
    const duplicateMechanics = Object.entries(m4m9Counts).filter(([, count]) => count > 1)
    if (duplicateMechanics.length > 0) {
      const names = duplicateMechanics.map(([id]) =>
        id === 'mechanic_1' ? 'Fill in the Blanks' : id === 'mechanic_2' ? 'MCQ' : 'Jumbled',
      )
      toast({
        title: 'Duplicate mechanic entries',
        description: `Only one of each type is allowed. Duplicates: ${names.join(', ')}.`,
        variant: 'destructive',
      })
      return
    }

    // Validate mechanic_3: jumbled_text is required
    for (const mech of (cleaned.mechanics_data ?? []) as any[]) {
      if (mech.mechanics_id === 'mechanic_3' && !mech.jumbled_text?.trim()) {
        toast({
          title: 'Jumbled text required',
          description: 'Jumbled Text is required for the Jumbled mechanic.',
          variant: 'destructive',
        })
        return
      }
    }

    // Validate M4-M9 mechanics: at least one of mechanic_1 or mechanic_2 must remain
    const allMechIds = ((cleaned.mechanics_data ?? []) as any[]).map((m: any) => m.mechanics_id)
    const hasM4M9Mechanics = allMechIds.some((id: string) =>
      ['mechanic_1', 'mechanic_2', 'mechanic_3'].includes(id),
    )
    if (hasM4M9Mechanics) {
      const hasMechanic1or2 = allMechIds.some((id: string) =>
        id === 'mechanic_1' || id === 'mechanic_2',
      )
      if (!hasMechanic1or2) {
        toast({
          title: 'Required mechanic missing',
          description: 'At least one Fill in the Blanks (mechanic_1) or MCQ (mechanic_2) entry must be present.',
          variant: 'destructive',
        })
        return
      }
    }

    // Edit mode: show change confirmation before saving.
    // Compare against the mount-time snapshot rather than dirtyFields to avoid
    // false positives caused by programmatic setValue calls (language sync, etc.).
    if (isEditMode) {
      const initial = initialValuesRef.current
      if (initial) {
        const changes = buildChanges(initial, data)
        if (changes.length === 0) {
          toast({ title: 'No changes to save', description: 'No fields were modified.' })
          return
        }
        setChangeList(changes)
        setPendingSubmit(cleaned)
        setConfirmOpen(true)
        return
      }
    }

    await onSubmit(cleaned)
  }

  async function handleConfirm() {
    if (!pendingSubmit) return
    setConfirmOpen(false)
    await onSubmit(pendingSubmit)
    setPendingSubmit(null)
  }

  const df = dirtyFields as Partial<Record<keyof ContentFormValues, any>>

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {isEditMode && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={handleLeave}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditMode && defaultValues?.contentId && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Content ID (read-only)</Label>
                <div className="flex items-center h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm font-mono text-muted-foreground select-all">
                  {defaultValues.contentId}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className={`space-y-1 ${dirty(!!df.name, isEditMode)}`}>
                <Label>Name *</Label>
                <Input placeholder="Content name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className={`space-y-1 ${dirty(!!df.publisher, isEditMode)}`}>
                <Label>Publisher</Label>
                <Input placeholder="e.g. Ekstep" {...register('publisher')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className={`space-y-1 ${dirty(!!df.contentType, isEditMode)}`}>
                <Label>Content Type *</Label>
                <Controller
                  control={control}
                  name="contentType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Word', 'Sentence', 'Paragraph', 'Char'].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className={`space-y-1 ${dirty(!!df.language, isEditMode)}`}>
                <Label>Language *</Label>
                <Controller
                  control={control}
                  name="language"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['en', 'hi', 'ta', 'te', 'kn', 'gu'].map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className={`space-y-1 ${dirty(!!df.status, isEditMode)}`}>
                <Label>Status *</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`space-y-1 ${dirty(!!df.collectionId, isEditMode)}`}>
                <Label>Collection</Label>
                <Controller
                  control={control}
                  name="collectionId"
                  render={({ field }) => (
                    <CollectionPickerField
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      defaultLanguage={watch('language')}
                      defaultContentType={watch('contentType')}
                    />
                  )}
                />
                {watch('collectionId') && (
                  <p className="text-xs font-mono text-muted-foreground truncate px-1">
                    {watch('collectionId')}
                  </p>
                )}
              </div>
              <div className={`space-y-1 ${dirty(!!df.contentIndex, isEditMode)}`}>
                <Label>Content Index</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register('contentIndex', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className={`space-y-1 ${dirty(!!df.imagePath, isEditMode)}`}>
              <Label>Image Path</Label>
              {isEditMode ? (
                <Controller
                  control={control}
                  name="imagePath"
                  render={({ field }) => (
                    <AssetUploadField
                      assetType="image"
                      value={field.value}
                      onChange={field.onChange}
                      fieldName={field.name}
                    />
                  )}
                />
              ) : (
                <>
                  <Input placeholder="e.g. image_2.jpg" {...register('imagePath')} />
                  <ImagePreview url={imagePath} />
                </>
              )}
            </div>

            <div className={`space-y-1 ${dirty(!!df.tags, isEditMode)}`}>
              <Label>Tags *</Label>
              <TagInput
                value={tags}
                onChange={(v) => setValue('tags', v, { shouldValidate: true })}
                placeholder="Add tags (press Enter or comma)..."
              />
              {errors.tags && <p className="text-xs text-destructive">{errors.tags.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Level &amp; Complexity</CardTitle>
          </CardHeader>
          <CardContent>
            <LevelComplexityField isEditMode={isEditMode} />
          </CardContent>
        </Card>

        {defaultValues?.multilingual && Object.keys(defaultValues.multilingual).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Multilingual Data</CardTitle>
            </CardHeader>
            <CardContent>
              <MultilingualField isEditMode={isEditMode} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Read Along</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!watchedSourceData?.[0]?.text?.trim()}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </CardHeader>
          <CardContent>
            <ContentSourceDataField isEditMode={isEditMode} contentId={defaultValues?.contentId} />
            {errors.contentSourceData && (
              <p className="text-xs text-destructive mt-2">
                {typeof errors.contentSourceData.message === 'string'
                  ? errors.contentSourceData.message
                  : 'Please fill in all required fields'}
              </p>
            )}
          </CardContent>
        </Card>

        {mode === 'mechanics' && (
          <Card>
            <CardContent className="pt-6">
              <MechanicsDataSection isEditMode={isEditMode} />
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={handleLeave}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Content'}
          </Button>
        </div>
      </form>

      {/* Read Along preview modal */}
      <ReadAlongPreviewModal
        content={{
          _id: defaultValues?._id ?? 'preview',
          contentId: defaultValues?.contentId ?? 'preview',
          name: defaultValues?.name ?? 'Preview',
          contentType: watchedType,
          language: watchedLang as Content['language'],
          status: 'draft',
          tags: [],
          contentSourceData: (watchedSourceData ?? []).map((s) => ({
            language: (s.language as Content['language']) ?? watchedLang as Content['language'],
            text: s.text ?? '',
            audioUrl: s.audioUrl,
          })),
        }}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* Change confirmation dialog — edit mode only */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) { setConfirmOpen(false); setPendingSubmit(null) }
        }}
        title="Confirm Changes"
        description={<ChangeSummary changes={changeList} />}
        onConfirm={handleConfirm}
        loading={isSubmitting}
        confirmLabel="Save Changes"
        confirmVariant="default"
      />

      {/* Unsaved changes warning — Back / Cancel */}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Unsaved Changes"
        description="You have unsaved changes. If you leave now they will be lost."
        onConfirm={() => navigate(-1)}
        confirmLabel="Leave Page"
        confirmVariant="destructive"
      />
    </FormProvider>
  )
}
