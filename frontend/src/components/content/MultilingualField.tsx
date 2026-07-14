import * as React from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { ChevronDown, ChevronRight, Plus, Trash2, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AudioPreview } from './MediaPreview'
import { AssetUploadField } from './AssetUploadField'
import { generateTts } from '@/api/content'
import { toast } from '@/hooks/use-toast'

const ALL_LANGS = [
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ta', label: 'Tamil' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ma', label: 'Marathi' },
]

interface MultilingualFieldProps {
  isEditMode?: boolean
}

export function MultilingualField({ isEditMode = false }: MultilingualFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [addLang, setAddLang] = React.useState('')
  const [generatingLang, setGeneratingLang] = React.useState<string | null>(null)
  const { register, watch, setValue, control } = useFormContext()

  // Snapshot of text + audio_url per language at mount — used to detect stale audio.
  const initialRef = React.useRef<Record<string, { text: string; audio_url: string }>>({})
  React.useEffect(() => {
    const ml = watch('multilingual') as Record<string, { text?: string; audio_url?: string }> | undefined
    if (!ml) return
    const snapshot: Record<string, { text: string; audio_url: string }> = {}
    for (const [lang, data] of Object.entries(ml)) {
      snapshot[lang] = { text: data?.text ?? '', audio_url: data?.audio_url ?? '' }
    }
    initialRef.current = snapshot
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const multilingual = watch('multilingual') as
    | Record<string, { text?: string; audio_url?: string }>
    | undefined

  if (!multilingual || Object.keys(multilingual).length === 0) return null

  const entries = Object.entries(multilingual)
  const usedLangs = new Set(entries.map(([lang]) => lang))
  const availableLangs = ALL_LANGS.filter((l) => !usedLangs.has(l.code))

  function handleAdd() {
    if (!addLang) return
    setValue(
      'multilingual',
      { ...multilingual, [addLang]: { text: '', audio_url: '' } },
      { shouldDirty: true },
    )
    setAddLang('')
  }

  function handleRemove(lang: string) {
    const updated = { ...multilingual }
    delete updated[lang]
    setValue('multilingual', updated, { shouldDirty: true })
  }

  async function handleRegen(lang: string, text: string, audioUrl: string) {
    if (!text.trim()) return
    setGeneratingLang(lang)
    try {
      const result = await generateTts(text.trim(), lang, audioUrl.trim(), 'multilingual_audios')
      setValue(`multilingual.${lang}.audio_url`, result, { shouldDirty: true })
      toast({ title: 'Audio regenerated', description: result })
    } catch (err: any) {
      toast({
        title: 'TTS generation failed',
        description: err?.response?.data?.message ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setGeneratingLang(null)
    }
  }

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <span>
          Multilingual Data{' '}
          <span className="text-muted-foreground font-normal">({entries.length} language{entries.length !== 1 ? 's' : ''})</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {entries.map(([lang, data]) => {
            const initial       = initialRef.current[lang]
            const currentText   = data?.text    ?? ''
            const currentAudio  = data?.audio_url ?? ''
            const textChanged   = isEditMode && !!initial && currentText   !== initial.text
            const audioUpdated  = isEditMode && !!initial && currentAudio  !== initial.audio_url
            const showStaleWarn = textChanged && !audioUpdated

            return (
            <div key={lang} className="border rounded-md p-3 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {ALL_LANGS.find((l) => l.code === lang)?.label ?? lang}{' '}
                  <span className="lowercase normal-case font-mono">({lang})</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive disabled:opacity-30"
                  onClick={() => handleRemove(lang)}
                  disabled={entries.length <= 1}
                  title={entries.length <= 1 ? 'At least one language entry is required' : undefined}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {showStaleWarn && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Text has changed — existing audio may be outdated.</span>
                  </div>
                  <button
                    type="button"
                    disabled={generatingLang === lang}
                    onClick={() => handleRegen(lang, currentText, currentAudio)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {generatingLang === lang
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                      : <><Sparkles className="h-3 w-3" /> Regenerate TTS</>}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Text</Label>
                  <Input {...register(`multilingual.${lang}.text`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audio URL</Label>
                  {isEditMode ? (
                    <Controller
                      control={control}
                      name={`multilingual.${lang}.audio_url`}
                      render={({ field }) => (
                        <AssetUploadField
                          assetType="audio"
                          value={field.value}
                          onChange={field.onChange}
                          language={lang}
                          audioType="multilingual"
                          audioFolder="multilingual_audios"
                          sourceText={data?.text}
                          fieldName={field.name}
                        />
                      )}
                    />
                  ) : (
                    <>
                      <Input {...register(`multilingual.${lang}.audio_url`)} />
                      <AudioPreview url={data?.audio_url} audioType="multilingual" />
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}

          {availableLangs.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Select value={addLang} onValueChange={setAddLang}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select language…" />
                </SelectTrigger>
                <SelectContent>
                  {availableLangs.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAdd}
                disabled={!addLang}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
