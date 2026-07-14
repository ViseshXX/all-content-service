import * as React from 'react'
import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Trash2, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TagInput } from '@/components/shared/TagInput'
import { AudioPreview } from './MediaPreview'
import { AssetUploadField } from './AssetUploadField'
import { generateTts } from '@/api/content'
import { toast } from '@/hooks/use-toast'

function d(isDirty: boolean, isEditMode: boolean) {
  return isEditMode && isDirty ? 'border-l-2 border-red-400 pl-2 bg-red-100 rounded-sm' : ''
}

export function ContentSourceDataField({ isEditMode = false, contentId }: { isEditMode?: boolean; contentId?: string }) {
  const { register, control, watch, setValue, formState: { dirtyFields } } = useFormContext()
  const { fields, remove } = useFieldArray({ control, name: 'contentSourceData' })

  const initialRef = React.useRef<Array<{ text: string; audioUrl: string }>>([])
  React.useEffect(() => {
    if (!isEditMode) return
    const current = (watch('contentSourceData') as Array<{ text?: string; audioUrl?: string }>) ?? []
    initialRef.current = current.map((item) => ({ text: item?.text ?? '', audioUrl: item?.audioUrl ?? '' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [generatingIdx, setGeneratingIdx] = React.useState<number | null>(null)

  async function handleRegen(index: number, text: string, audioUrl: string, language: string) {
    if (!text.trim()) return
    setGeneratingIdx(index)
    try {
      const folder = `all-audio-files/${language || 'en'}`
      const result = await generateTts(text.trim(), language || 'en', audioUrl.trim(), folder)
      setValue(`contentSourceData.${index}.audioUrl`, result, { shouldDirty: true })
      toast({ title: 'Audio regenerated', description: result })
    } catch (err: any) {
      toast({
        title: 'TTS generation failed',
        description: err?.response?.data?.message ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setGeneratingIdx(null)
    }
  }

  const sourceData  = watch('contentSourceData') ?? []
  const srcDirty    = (dirtyFields as any).contentSourceData ?? []

  // If the content already has embedded multilingual translations (M1-M3 type),
  // don't show the multilingual_id field (those templates use multilingual, not multilingual_id).
  const parentMultilingual = watch('multilingual')
  const hasEmbeddedMultilingual = !!parentMultilingual && Object.keys(parentMultilingual).length > 0

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const item  = sourceData[index] ?? {}
        const entry = srcDirty[index]  ?? {}

        const computedFields = [
          { key: 'phonemes',             label: 'Phonemes',           value: item.phonemes ? (item.phonemes as string[]).join(', ') : null },
          { key: 'wordCount',            label: 'Word Count',         value: item.wordCount ?? null },
          { key: 'syllableCount',        label: 'Syllable Count',     value: item.syllableCount ?? null },
          { key: 'totalOrthoComplexity', label: 'Ortho Complexity',   value: item.totalOrthoComplexity ?? null },
          { key: 'totalPhonicComplexity',label: 'Phonic Complexity',  value: item.totalPhonicComplexity ?? null },
          { key: 'readingComplexity',    label: 'Reading Complexity', value: item.readingComplexity ?? null },
        ].filter((f) => f.value !== null && f.value !== undefined)

        const initial     = initialRef.current[index]
        const currentText  = item.text ?? ''
        const currentAudio = item.audioUrl ?? ''
        const textChanged  = isEditMode && !!initial && currentText  !== initial.text
        const audioUpdated = isEditMode && !!initial && currentAudio !== initial.audioUrl
        const showStaleWarn = textChanged && !audioUpdated

        return (
          <div key={field.id} className="border rounded-md p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Entry {index + 1}</span>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Language</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground font-mono">
                  {item.language || '—'}
                </div>
                <p className="text-xs text-muted-foreground">Set from Basic Information</p>
              </div>
              <div className={`space-y-1 ${d(!!entry.audioUrl, isEditMode)}`}>
                <Label>Audio URL</Label>
                {isEditMode ? (
                  <Controller
                    control={control}
                    name={`contentSourceData.${index}.audioUrl`}
                    render={({ field }) => (
                      <AssetUploadField
                        assetType="audio"
                        value={field.value}
                        onChange={field.onChange}
                        language={item.language}
                        audioType="content"
                        contentId={contentId}
                        sourceText={item.text}
                        readonly={!!contentId}
                        fieldName={field.name}
                      />
                    )}
                  />
                ) : (
                  <>
                    <Input
                      placeholder="https://..."
                      {...register(`contentSourceData.${index}.audioUrl`)}
                    />
                    <AudioPreview url={item.audioUrl} audioType="content" language={item.language} />
                  </>
                )}
              </div>
            </div>

            {showStaleWarn && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Text has changed — existing audio may be outdated.</span>
                </div>
                <button
                  type="button"
                  disabled={generatingIdx === index}
                  onClick={() => handleRegen(index, currentText, currentAudio, item.language)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {generatingIdx === index
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                    : <><Sparkles className="h-3 w-3" /> Regenerate TTS</>}
                </button>
              </div>
            )}

            <div className={`space-y-1 ${d(!!entry.text, isEditMode)}`}>
              <Label>Text *</Label>
              <Textarea
                placeholder="Enter content text..."
                className="min-h-[80px]"
                {...register(`contentSourceData.${index}.text`)}
              />
            </div>

            {!isEditMode && (
              <div className="space-y-1">
                <Label>Instruction Audio URL</Label>
                <Input
                  placeholder="https://..."
                  {...register(`contentSourceData.${index}.inst_audioUrl`)}
                />
                <AudioPreview url={item.inst_audioUrl} audioType="content" language={item.language} />
              </div>
            )}

            {!hasEmbeddedMultilingual && item.language === 'en' && (
              <div className="pt-2 border-t space-y-1">
                <Label className="text-xs font-medium">Multilingual Words</Label>
                <p className="text-xs text-muted-foreground">Each word must exist in the multilingual collection. At least 1 required.</p>
                <Controller
                  control={control}
                  name={`contentSourceData.${index}.multilingual_id`}
                  defaultValue={item.multilingual_id ?? []}
                  render={({ field }) => (
                    <TagInput
                      value={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Add word and press Enter…"
                    />
                  )}
                />
              </div>
            )}

            {computedFields.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Computed (read-only)</p>
                <div className="flex flex-wrap gap-1.5">
                  {computedFields.map((f) => (
                    <Badge key={f.key} variant="secondary" className="text-xs">
                      {f.label}: {String(f.value)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
          No language entries. Click "Add Language" to add one.
        </p>
      )}
    </div>
  )
}
