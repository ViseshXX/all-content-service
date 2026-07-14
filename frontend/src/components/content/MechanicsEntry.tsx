import * as React from 'react'
import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { ChevronDown, ChevronRight, Plus, Trash2, Eye, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/shared/TagInput'
import { AudioPreview, ImagePreview } from './MediaPreview'
import { AssetUploadField } from './AssetUploadField'
import { generateTts } from '@/api/content'
import { toast } from '@/hooks/use-toast'
import { MCQPreviewModal } from './MCQPreviewModal'
import { M1PreviewModal } from './M1PreviewModal'
import { M2PreviewModal } from './M2PreviewModal'
import { M3PreviewModal } from './M3PreviewModal'
import { FillBlanksPreviewModal } from './FillBlanksPreviewModal'

const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu']

// Mirrors backend SingleContentAssetService.extractKeywords
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','is','are','was','were','it','its',
  'to','of','in','on','that','this','with','for','as','by','at','they',
  'he','she','some',
])

function extractKeywords(text: string, maxKeywords = 2): string[] {
  const words: string[] = text.match(/\p{L}+/gu) ?? []
  if (words.length <= maxKeywords) return words
  let content = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()))
  if (content.length < maxKeywords) content = words
  content.sort((a, b) => b.length - a.length)
  return content.slice(0, maxKeywords)
}

const MECHANICS_LABELS: Record<string, string> = {
  mechanic_1:  'Fill in the Blanks',
  mechanic_2:  'MCQ',
  mechanic_3:  'Jumbled',
  M1_L:        'M1 — Syllable Breakdown',
  M2_L:        'M2 — Word-Image Match',
  M3_L:        'M3 — Sentence-Image MCQ',
  mechanic_14: 'M10-M15 — Announcement Flow',
}

interface MechanicsEntryProps {
  index: number
  onRemove: () => void
  isEditMode?: boolean
  canRemove?: boolean
}

function d(isDirty: boolean, isEditMode: boolean) {
  return isEditMode && isDirty ? 'border-l-2 border-red-400 pl-2 bg-red-100 rounded-sm' : ''
}

/** Reusable audio upload/preview toggle for mechanics fields */
function MechAudioField({
  name,
  isEditMode,
  previewUrl,
  sourceText,
}: {
  name: string
  isEditMode: boolean
  previewUrl?: string
  sourceText?: string
}) {
  const { register, control } = useFormContext()
  if (isEditMode) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <AssetUploadField
            assetType="audio"
            value={field.value}
            onChange={field.onChange}
            audioType="mechanics"
            audioFolder="mechanics_audios"
            sourceText={sourceText}
            fieldName={field.name}
          />
        )}
      />
    )
  }
  return (
    <>
      <Input placeholder="filename.wav" {...register(name)} />
      <AudioPreview url={previewUrl} audioType="mechanics" />
    </>
  )
}

/** Reusable image upload/preview toggle for mechanics fields */
function MechImageField({
  name,
  isEditMode,
  previewUrl,
}: {
  name: string
  isEditMode: boolean
  previewUrl?: string
}) {
  const { register, control } = useFormContext()
  if (isEditMode) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <AssetUploadField
            assetType="image"
            value={field.value}
            onChange={field.onChange}
            fieldName={field.name}
          />
        )}
      />
    )
  }
  return (
    <>
      <Input placeholder="filename.png" {...register(name)} />
      <ImagePreview url={previewUrl} />
    </>
  )
}

export function MechanicsEntryComponent({ index, onRemove, isEditMode = false, canRemove = true }: MechanicsEntryProps) {
  const [open, setOpen] = React.useState(true)
  const [previewOpen, setPreviewOpen]     = React.useState(false)
  const [m1PreviewOpen, setM1PreviewOpen] = React.useState(false)
  const [m2PreviewOpen, setM2PreviewOpen] = React.useState(false)
  const [m3PreviewOpen,          setM3PreviewOpen]          = React.useState(false)
  const [fillBlanksPreviewOpen, setFillBlanksPreviewOpen] = React.useState(false)
  const { register, control, watch, setValue, formState: { dirtyFields } } = useFormContext()

  const basePath = `mechanics_data.${index}`

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: `${basePath}.options`,
  })

  const { fields: syllableFields, append: appendSyllable, remove: removeSyllable } = useFieldArray({
    control,
    name: `${basePath}.syllable`,
  })

  const { fields: imageAudioFields, append: appendImageAudio, remove: removeImageAudio } = useFieldArray({
    control,
    name: `${basePath}.imageAudioMap`,
  })

  const words         = watch(`${basePath}.words`) ?? []
  const correctness50 = watch(`${basePath}.correctness.50%`) ?? []
  const mechanicsId:   string = watch(`${basePath}.mechanics_id`) ?? ''
  const mechText:        string = watch(`${basePath}.text`) ?? ''
  const mechJumbledText: string = watch(`${basePath}.jumbled_text`) ?? ''
  const mechAudioUrl:  string = watch(`${basePath}.audio_url`) ?? ''
  const mechImageUrl:  string = watch(`${basePath}.image_url`) ?? ''
  const mechLanguage:  string = watch(`${basePath}.language`) ?? 'en'
  const contentLanguage: string = watch('language') ?? 'en'
  const contentType:   string = watch('contentType') ?? 'Word'
  const sourceText:    string = watch('contentSourceData.0.text') ?? ''
  const sourceAudioUrl: string = watch('contentSourceData.0.audioUrl') ?? ''
  const entryDirty = ((dirtyFields as any).mechanics_data?.[index]) ?? {}

  // Snapshot of text + audio_url at mount — used to detect stale audio in edit mode.
  const initialRef = React.useRef<{
    mech: { text: string; audio_url: string } | null
    imageAudioMap: Array<{ text: string; audio_url: string }>
    syllable: Array<{ text: string; audio_url: string }>
  }>({ mech: null, imageAudioMap: [], syllable: [] })
  React.useEffect(() => {
    if (!isEditMode) return
    const toSnap = (arr: Array<{ text?: string; audio_url?: string }> | undefined) =>
      (arr ?? []).map((e) => ({ text: e?.text ?? '', audio_url: e?.audio_url ?? '' }))
    initialRef.current = {
      mech: {
        text: (watch(`${basePath}.text`) as string) ?? '',
        audio_url: (watch(`${basePath}.audio_url`) as string) ?? '',
      },
      imageAudioMap: toSnap(watch(`${basePath}.imageAudioMap`) as Array<{ text?: string; audio_url?: string }>),
      syllable:      toSnap(watch(`${basePath}.syllable`)      as Array<{ text?: string; audio_url?: string }>),
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [generatingTts,        setGeneratingTts]        = React.useState(false)
  const [generatingMapIdx,     setGeneratingMapIdx]     = React.useState<number | null>(null)
  const [generatingSyllableIdx, setGeneratingSyllableIdx] = React.useState<number | null>(null)

  async function handleRegenMech() {
    if (!mechText.trim()) return
    setGeneratingTts(true)
    try {
      const result = await generateTts(mechText.trim(), mechLanguage, mechAudioUrl.trim(), 'mechanics_audios')
      setValue(`${basePath}.audio_url`, result, { shouldDirty: true })
      toast({ title: 'Audio regenerated', description: result })
    } catch (err: any) {
      toast({ title: 'TTS generation failed', description: err?.response?.data?.message ?? err?.message ?? 'Unknown error', variant: 'destructive' })
    } finally {
      setGeneratingTts(false)
    }
  }

  async function handleRegenSyllable(i: number, text: string, audioUrl: string) {
    if (!text.trim()) return
    setGeneratingSyllableIdx(i)
    try {
      const result = await generateTts(text.trim(), mechLanguage, audioUrl.trim(), 'mechanics_audios')
      setValue(`${basePath}.syllable.${i}.audio_url`, result, { shouldDirty: true })
      toast({ title: 'Audio regenerated', description: result })
    } catch (err: any) {
      toast({ title: 'TTS generation failed', description: err?.response?.data?.message ?? err?.message ?? 'Unknown error', variant: 'destructive' })
    } finally {
      setGeneratingSyllableIdx(null)
    }
  }

  async function handleRegenMapEntry(i: number, text: string, audioUrl: string) {
    if (!text.trim()) return
    setGeneratingMapIdx(i)
    try {
      const result = await generateTts(text.trim(), mechLanguage, audioUrl.trim(), 'mechanics_audios')
      setValue(`${basePath}.imageAudioMap.${i}.audio_url`, result, { shouldDirty: true })
      toast({ title: 'Audio regenerated', description: result })
    } catch (err: any) {
      toast({ title: 'TTS generation failed', description: err?.response?.data?.message ?? err?.message ?? 'Unknown error', variant: 'destructive' })
    } finally {
      setGeneratingMapIdx(null)
    }
  }

  const hasMechTextAudio = !['M1_L', 'M2_L', 'M3_L', 'mechanic_3'].includes(mechanicsId)
  const mechStaleWarn = isEditMode && hasMechTextAudio
    && !!initialRef.current.mech
    && mechText !== initialRef.current.mech.text
    && mechAudioUrl === initialRef.current.mech.audio_url

  // Auto-compute correctness['50%'] for mechanic_2 — mirrors bulk upload logic.
  // Runs whenever options change (text or isAns flag).
  const options = watch(`${basePath}.options`) ?? []
  React.useEffect(() => {
    if (mechanicsId !== 'mechanic_2') return
    const correctOpt = (options as any[]).find((o: any) => o?.isAns)
    if (!correctOpt?.text?.trim()) return
    setValue(`${basePath}.correctness.50%`, extractKeywords(correctOpt.text), { shouldDirty: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options), mechanicsId])

  return (
    <>
    <div className="border rounded-md bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30"
      >
        <span>
          {MECHANICS_LABELS[mechanicsId]
            ? `${MECHANICS_LABELS[mechanicsId]} (${mechanicsId})`
            : mechanicsId || '(no id)'}
        </span>
        <div className="flex items-center gap-2">
          {mechanicsId === 'mechanic_1' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={!mechText.trim() && optionFields.length === 0}
              onClick={(e) => { e.stopPropagation(); setFillBlanksPreviewOpen(true) }}
              title="Preview Fill in the Blanks"
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          )}
          {mechanicsId === 'mechanic_2' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={!mechText.trim()}
              onClick={(e) => { e.stopPropagation(); setPreviewOpen(true) }}
              title="Preview MCQ"
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          )}
          {mechanicsId === 'M1_L' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={!sourceText.trim() && !mechImageUrl.trim()}
              onClick={(e) => { e.stopPropagation(); setM1PreviewOpen(true) }}
              title="Preview M1 Mechanic"
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          )}
          {mechanicsId === 'M2_L' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={words.length === 0 && imageAudioFields.length === 0}
              onClick={(e) => { e.stopPropagation(); setM2PreviewOpen(true) }}
              title="Preview M2 Mechanic"
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          )}
          {mechanicsId === 'M3_L' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={optionFields.length === 0 && !sourceText.trim()}
              onClick={(e) => { e.stopPropagation(); setM3PreviewOpen(true) }}
              title="Preview M3 Mechanic"
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          )}
          {!(isEditMode && ['M1_L', 'M2_L', 'M3_L'].includes(mechanicsId)) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive disabled:opacity-30"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              disabled={!canRemove}
              title={!canRemove ? 'At least one of mechanic_1 or mechanic_2 must remain' : undefined}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`space-y-1 ${d(!!entryDirty.mechanics_id, isEditMode)}`}>
              <Label>Mechanics ID *</Label>
              {isEditMode && ['M1_L', 'M2_L', 'M3_L', 'mechanic_1', 'mechanic_2', 'mechanic_3'].includes(mechanicsId) ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground font-mono">
                  {mechanicsId}
                </div>
              ) : (
                <Input placeholder="e.g. MCQ_1" {...register(`${basePath}.mechanics_id`)} />
              )}
            </div>
            <div className={`space-y-1 ${d(!!entryDirty.language, isEditMode)}`}>
              <Label>Language *</Label>
              <Controller
                control={control}
                name={`${basePath}.language`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {!['M1_L', 'M2_L', 'M3_L', 'mechanic_1', 'mechanic_2', 'mechanic_3'].includes(mechanicsId) && (
            <div className={`space-y-1 ${d(!!entryDirty.content_body, isEditMode)}`}>
              <Label>Content Body (JSON)</Label>
              <Textarea
                placeholder="Stringified JSON with data.tasks array"
                className="min-h-[120px] font-mono text-xs"
                {...register(`${basePath}.content_body`)}
              />
            </div>
          )}

          {/* Text — shown for mechanic_1, mechanic_2, and generic mechanics; hidden for M-L types and mechanic_3 */}
          {!['M1_L', 'M2_L', 'M3_L', 'mechanic_3'].includes(mechanicsId) && (
            <div className={`space-y-1 ${d(!!entryDirty.text, isEditMode)}`}>
              <Label>Text</Label>
              <Input placeholder="Display text" {...register(`${basePath}.text`)} />
            </div>
          )}

          {/* Jumbled Text — compulsory for mechanic_3; shown for generic mechanics; hidden for M-L types, mechanic_1, mechanic_2 */}
          {!['M1_L', 'M2_L', 'M3_L', 'mechanic_1', 'mechanic_2'].includes(mechanicsId) && (
            <div className={`space-y-1 ${d(!!entryDirty.jumbled_text, isEditMode)}`}>
              <Label>
                Jumbled Text{mechanicsId === 'mechanic_3' && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Input placeholder="For reordering exercises" {...register(`${basePath}.jumbled_text`)} />
            </div>
          )}

          {mechStaleWarn && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Text has changed — existing audio may be outdated.</span>
              </div>
              <button
                type="button"
                disabled={generatingTts}
                onClick={handleRegenMech}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {generatingTts
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                  : <><Sparkles className="h-3 w-3" /> Regenerate TTS</>}
              </button>
            </div>
          )}

          {/* Entry-level audio / image / time limit */}
          {['M1_L', 'M2_L', 'M3_L'].includes(mechanicsId) && (
            <div className="space-y-1">
              <Label>Image URL</Label>
              <MechImageField
                name={`${basePath}.image_url`}
                isEditMode={isEditMode}
                previewUrl={mechImageUrl}
              />
            </div>
          )}
          {!['M1_L', 'M2_L', 'M3_L'].includes(mechanicsId) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Audio URL</Label>
                <MechAudioField
                  name={`${basePath}.audio_url`}
                  isEditMode={isEditMode}
                  previewUrl={mechAudioUrl}
                  sourceText={mechanicsId === 'mechanic_3' ? mechJumbledText : mechText}
                />
              </div>
              <div className="space-y-1">
                <Label>Image URL</Label>
                <MechImageField
                  name={`${basePath}.image_url`}
                  isEditMode={isEditMode}
                  previewUrl={mechImageUrl}
                />
              </div>
              <div className="space-y-1">
                <Label>Time Limit (s)</Label>
                {['mechanic_1', 'mechanic_2', 'mechanic_3'].includes(mechanicsId) ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground font-mono">
                    {watch(`${basePath}.time_limit`) ?? '—'}
                  </div>
                ) : (
                  <Input type="number" placeholder="30" {...register(`${basePath}.time_limit`, { valueAsNumber: true })} />
                )}
              </div>
            </div>
          )}

          {/* Options — hidden for M1_L, M2_L, and mechanic_3 */}
          {!['M1_L', 'M2_L', 'mechanic_3'].includes(mechanicsId) && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Options</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendOption({ text: '', audio_url: '', image_url: '', isAns: false, side: '' })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Option
              </Button>
            </div>
            {optionFields.map((f, i) => {
              const optAudio: string = watch(`${basePath}.options.${i}.audio_url`) ?? ''
              const optImage: string = watch(`${basePath}.options.${i}.image_url`) ?? ''
              return (
                <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-start border rounded p-2 bg-background">
                  <div className="space-y-1">
                    <Label className="text-xs">Text</Label>
                    <Input size={1} {...register(`${basePath}.options.${i}.text`)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Audio URL{mechanicsId === 'mechanic_2' && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    <MechAudioField
                      name={`${basePath}.options.${i}.audio_url`}
                      isEditMode={isEditMode}
                      previewUrl={optAudio}
                      sourceText={watch(`${basePath}.options.${i}.text`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Image URL</Label>
                    <MechImageField
                      name={`${basePath}.options.${i}.image_url`}
                      isEditMode={isEditMode}
                      previewUrl={optImage}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Answer</Label>
                    <Controller
                      control={control}
                      name={`${basePath}.options.${i}.isAns`}
                      render={({ field }) => (
                        <button
                          type="button"
                          title={field.value ? 'Marked as correct answer' : 'Mark as correct answer'}
                          onClick={() => field.onChange(!field.value)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors border-2 ${
                            field.value
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-transparent border-muted-foreground/30 text-transparent hover:border-green-400'
                          }`}
                        >
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        </button>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive disabled:opacity-30"
                    onClick={() => removeOption(i)}
                    disabled={['mechanic_1', 'mechanic_2'].includes(mechanicsId) && optionFields.length <= 2}
                    title={['mechanic_1', 'mechanic_2'].includes(mechanicsId) && optionFields.length <= 2 ? 'At least 2 options are required' : undefined}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>}

          {/* Hints — hidden for M1_L and M2_L */}
          {!['M1_L', 'M2_L', 'M3_L'].includes(mechanicsId) && (
            <div className="border rounded-md p-3 space-y-2">
              <Label className="font-semibold">Hints</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Text</Label>
                  <Input {...register(`${basePath}.hints.text`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audio URL</Label>
                  <MechAudioField
                    name={`${basePath}.hints.audio_url`}
                    isEditMode={isEditMode}
                    previewUrl={watch(`${basePath}.hints.audio_url`)}
                    sourceText={watch(`${basePath}.hints.text`)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Image URL</Label>
                  <MechImageField
                    name={`${basePath}.hints.image_url`}
                    isEditMode={isEditMode}
                    previewUrl={watch(`${basePath}.hints.image_url`)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Correctness 50% — hidden for M1_L, M2_L, M3_L, mechanic_1, mechanic_3 */}
          {!['M1_L', 'M2_L', 'M3_L', 'mechanic_1', 'mechanic_3'].includes(mechanicsId) && <div className="space-y-1">
            <Label>Correctness (50%)</Label>
            <TagInput
              value={correctness50}
              onChange={(v) => setValue(`${basePath}.correctness.50%`, v)}
              placeholder="Add items..."
            />
          </div>}

          {/* Words — only used by M2_L (Word-Image Match) for shuffled word parts */}
          {mechanicsId === 'M2_L' && (
            <div className="space-y-1">
              <Label>Words</Label>
              <TagInput
                value={words}
                onChange={(v) => setValue(`${basePath}.words`, v)}
                placeholder="Add words..."
              />
            </div>
          )}

          {/* Syllable Breakdown — only relevant for M1_L */}
          {mechanicsId === 'M1_L' && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Syllable Breakdown</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendSyllable({ text: '', audio_url: '' })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {syllableFields.map((f, i) => {
              const sylText  = (watch(`${basePath}.syllable.${i}.text`)      as string) ?? ''
              const sylAudio = (watch(`${basePath}.syllable.${i}.audio_url`) as string) ?? ''
              const sylInitial = initialRef.current.syllable[i]
              const sylStale = isEditMode && !!sylInitial
                && sylText  !== sylInitial.text
                && sylAudio === sylInitial.audio_url

              return (
                <div key={f.id} className="border rounded p-2 space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Text</Label>
                      <Input {...register(`${basePath}.syllable.${i}.text`)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Audio URL</Label>
                      <MechAudioField
                        name={`${basePath}.syllable.${i}.audio_url`}
                        isEditMode={isEditMode}
                        previewUrl={sylAudio}
                        sourceText={sylText}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive disabled:opacity-30"
                      onClick={() => removeSyllable(i)}
                      disabled={syllableFields.length <= 1}
                      title={syllableFields.length <= 1 ? 'At least one syllable breakdown is required' : undefined}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {sylStale && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Text has changed — existing audio may be outdated.</span>
                      </div>
                      <button
                        type="button"
                        disabled={generatingSyllableIdx === i}
                        onClick={() => handleRegenSyllable(i, sylText, sylAudio)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {generatingSyllableIdx === i
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                          : <><Sparkles className="h-3 w-3" /> Regenerate TTS</>}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>}

          {/* Image Audio Map — only relevant for M2_L */}
          {mechanicsId === 'M2_L' && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Image Audio Map</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendImageAudio({ text: '', multilingual_id: '', audio_url: '', image_url: '' })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {imageAudioFields.map((f, i) => {
              const mapText  = (watch(`${basePath}.imageAudioMap.${i}.text`)      as string) ?? ''
              const mapAudio = (watch(`${basePath}.imageAudioMap.${i}.audio_url`) as string) ?? ''
              const mapInitial = initialRef.current.imageAudioMap[i]
              const mapStale = isEditMode && !!mapInitial
                && mapText  !== mapInitial.text
                && mapAudio === mapInitial.audio_url

              return (
                <div key={f.id} className="border rounded p-2 space-y-2">
                  <div className={`grid gap-2 items-start ${contentLanguage === 'en' ? 'grid-cols-[1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[1fr_1fr_1fr_auto]'}`}>
                    <div className="space-y-1">
                      <Label className="text-xs">Text</Label>
                      <Input {...register(`${basePath}.imageAudioMap.${i}.text`)} />
                    </div>
                    {contentLanguage === 'en' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Multilingual ID</Label>
                        <Input {...register(`${basePath}.imageAudioMap.${i}.multilingual_id`)} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Audio URL</Label>
                      <MechAudioField
                        name={`${basePath}.imageAudioMap.${i}.audio_url`}
                        isEditMode={isEditMode}
                        previewUrl={mapAudio}
                        sourceText={mapText}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image URL</Label>
                      <MechImageField
                        name={`${basePath}.imageAudioMap.${i}.image_url`}
                        isEditMode={isEditMode}
                        previewUrl={watch(`${basePath}.imageAudioMap.${i}.image_url`)}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeImageAudio(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {mapStale && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Text has changed — existing audio may be outdated.</span>
                      </div>
                      <button
                        type="button"
                        disabled={generatingMapIdx === i}
                        onClick={() => handleRegenMapEntry(i, mapText, mapAudio)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {generatingMapIdx === i
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                          : <><Sparkles className="h-3 w-3" /> Regenerate TTS</>}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>}
        </div>
      )}
    </div>

    {mechanicsId === 'mechanic_1' && (
      <FillBlanksPreviewModal
        content={{
          _id: 'preview',
          contentId: 'preview',
          name: 'Preview',
          contentType: contentType as any,
          language: contentLanguage as any,
          status: 'draft',
          tags: [],
          contentSourceData: [],
          mechanics_data: [{
            mechanics_id: 'mechanic_1',
            language: contentLanguage as any,
            text: mechText,
            image_url: mechImageUrl || undefined,
            options: options,
          }],
        }}
        open={fillBlanksPreviewOpen}
        onClose={() => setFillBlanksPreviewOpen(false)}
      />
    )}
    {mechanicsId === 'mechanic_2' && (
      <MCQPreviewModal
        content={{
          _id: 'preview',
          contentId: 'preview',
          name: 'Preview',
          contentType: contentType as any,
          language: contentLanguage as any,
          status: 'draft',
          tags: [],
          contentSourceData: [],
          mechanics_data: [{
            mechanics_id: 'mechanic_2',
            language: contentLanguage as any,
            text: mechText,
            image_url: mechImageUrl || undefined,
            audio_url: mechAudioUrl || undefined,
            options: options,
          }],
        }}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    )}
    {mechanicsId === 'M1_L' && (
      <M1PreviewModal
        content={{
          _id: 'preview',
          contentId: 'preview',
          name: 'Preview',
          contentType: contentType as any,
          language: contentLanguage as any,
          status: 'draft',
          tags: [],
          contentSourceData: [{
            language: contentLanguage as any,
            text: sourceText,
            audioUrl: sourceAudioUrl || undefined,
          }],
          mechanics_data: [{
            mechanics_id: 'M1_L',
            language: contentLanguage as any,
            image_url: mechImageUrl || undefined,
          }],
        }}
        open={m1PreviewOpen}
        onClose={() => setM1PreviewOpen(false)}
      />
    )}
    {mechanicsId === 'M2_L' && (
      <M2PreviewModal
        content={{
          _id: 'preview',
          contentId: 'preview',
          name: 'Preview',
          contentType: contentType as any,
          language: contentLanguage as any,
          status: 'draft',
          tags: [],
          contentSourceData: [],
          mechanics_data: [{
            mechanics_id: 'M2_L',
            language: contentLanguage as any,
            words: words,
            imageAudioMap: watch(`${basePath}.imageAudioMap`) ?? [],
          }],
        }}
        open={m2PreviewOpen}
        onClose={() => setM2PreviewOpen(false)}
      />
    )}
    {mechanicsId === 'M3_L' && (
      <M3PreviewModal
        content={{
          _id: 'preview',
          contentId: 'preview',
          name: 'Preview',
          contentType: contentType as any,
          language: contentLanguage as any,
          status: 'draft',
          tags: [],
          contentSourceData: [{
            language: contentLanguage as any,
            text: sourceText,
            audioUrl: sourceAudioUrl || undefined,
          }],
          mechanics_data: [{
            mechanics_id: 'M3_L',
            language: contentLanguage as any,
            options: options,
          }],
        }}
        open={m3PreviewOpen}
        onClose={() => setM3PreviewOpen(false)}
      />
    )}
    </>
  )
}
