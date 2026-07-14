import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TagInput } from '@/components/shared/TagInput'
import { CollectionPickerField } from '@/components/shared/CollectionPickerField'
import { FileUploadField } from './FileUploadField'
import { useCreateContentWithAssets } from '@/hooks/useContent'
import { toast } from '@/hooks/use-toast'
import { ReadAlongPreviewModal } from './ReadAlongPreviewModal'
import type { Content } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────

export type ReadAlongTemplateType =
  | 'M1 to M2 Read Along Content'
  | 'M4 to M6 Read Along Content'
  | 'Textbook image mechanic'


const ML_LANGUAGES = [
  { code: 'kn', label: 'Kannada' },
  { code: 'te', label: 'Telugu' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ma', label: 'Marathi' },
] as const

// ─────────────────────────────────────────────────────────────────────────────

const INDIC_REGEX = /[\u0900-\u0DFF\u1C80-\u1CFF\uA830-\uA83F]/

const SCRIPT_REGEX: Record<string, RegExp> = {
  hi: /[\u0900-\u097F]/,
  ma: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  gu: /[\u0A80-\u0AFF]/,
}

// ─────────────────────────────────────────────────────────────────────────────

interface FormValues {
  name: string
  contentType: string
  language: string
  status: string
  collectionId: string
  tags: string[]
  text: string
  multilingual_words: string
}

interface MlEntry {
  text: string
  file: File | null
}

interface Props {
  templateType: ReadAlongTemplateType
}

export function TemplateContentForm({ templateType }: Props) {
  const navigate = useNavigate()
  const createMutation = useCreateContentWithAssets()

  // ── File inputs (outside react-hook-form) ──────────────────────────────────
  const [audioFile, setAudioFile]     = React.useState<File | null>(null)
  const [imageFile, setImageFile]     = React.useState<File | null>(null)
  const [instAudio, setInstAudio]     = React.useState<File | null>(null)
  const [mlEntries, setMlEntries]     = React.useState<Record<string, MlEntry>>(
    () => Object.fromEntries(ML_LANGUAGES.map(({ code }) => [code, { text: '', file: null }])),
  )

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      contentType: 'Word',
      language: 'en',
      status: 'live',
      collectionId: '',
      tags: [],
      text: '',
      multilingual_words: '',
    },
  })

  const language    = watch('language')
  const watchedText = watch('text')
  const watchedType = watch('contentType')

  const [previewOpen, setPreviewOpen] = React.useState(false)

  // Minimal Content object built from current form values — no audio (not uploaded yet)
  const previewContent: Content = {
    _id: 'preview',
    contentId: 'preview',
    name: 'Preview',
    contentType: watchedType as Content['contentType'],
    language: language as Content['language'],
    status: 'draft',
    tags: [],
    contentSourceData: [{ language: language as Content['language'], text: watchedText }],
  }

  // ── Template feature flags ─────────────────────────────────────────────────
  const isM1M3       = templateType === 'M1 to M2 Read Along Content'
  const showInstAudio = false // not needed currently
  const showInlineML  = isM1M3 && language === 'en'
  const showMLWords   = (
    templateType === 'M4 to M6 Read Along Content' ||
    templateType === 'Textbook image mechanic'
  ) && language === 'en'
  const imageRequired = templateType === 'Textbook image mechanic'

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    // Client-side validation for template-specific requirements
    if (imageRequired && !imageFile) {
      toast({ title: 'Image required', description: 'Please upload an image for this template.', variant: 'destructive' })
      return
    }
    // Unicode / script validation (mirrors bulk-upload validateUnicode)
    const textTrimmed = values.text.trim()
    if (values.language === 'en' && INDIC_REGEX.test(textTrimmed)) {
      toast({ title: 'Script mismatch', description: "Language is 'English' but text contains Indic characters.", variant: 'destructive' })
      return
    }
    if (values.language !== 'en' && !INDIC_REGEX.test(textTrimmed)) {
      toast({ title: 'Script mismatch', description: `Language is '${values.language}' but text contains no Indic characters.`, variant: 'destructive' })
      return
    }

    if (values.tags.length === 0) {
      toast({ title: 'Tags required', description: 'Please add at least one tag.', variant: 'destructive' })
      return
    }
    if (showMLWords && !values.multilingual_words.trim()) {
      toast({ title: 'Multilingual words required', description: 'Enter at least one word.', variant: 'destructive' })
      return
    }
    if (showInlineML) {
      const hasAtLeastOne = ML_LANGUAGES.some(({ code }) => mlEntries[code].text.trim())
      if (!hasAtLeastOne) {
        toast({ title: 'Multilingual translations required', description: 'Fill in at least one language translation.', variant: 'destructive' })
        return
      }
      // Validate each filled entry uses the correct script
      for (const { code, label } of ML_LANGUAGES) {
        const entry = mlEntries[code]
        if (!entry.text.trim()) continue
        const scriptRx = SCRIPT_REGEX[code]
        if (scriptRx && !scriptRx.test(entry.text)) {
          toast({ title: 'Script mismatch', description: `${label} translation does not appear to use the correct script.`, variant: 'destructive' })
          return
        }
      }
    }

    // Build flat fields record (mirrors Excel column names)
    const fields: Record<string, string> = {
      templateType,
      name:               values.name.trim(),
      contentType:        values.contentType,
      language:           values.language,
      status:             values.status,
      tags:               values.tags.join(','),
      text:               values.text.trim(),
      multilingual_words: values.multilingual_words.trim(),
    }
    if (values.collectionId) fields.collectionId = values.collectionId

    // Add inline multilingual text fields
    if (showInlineML) {
      for (const { code } of ML_LANGUAGES) {
        const entry = mlEntries[code]
        if (entry.text.trim()) {
          fields[`multilingual_${code}_text`] = entry.text.trim()
        }
      }
    }

    // Build files record
    const files: Record<string, File> = {}
    if (audioFile)  files.audio_file = audioFile
    if (imageFile)  files.image      = imageFile
    if (instAudio)  files.instruction_audio_file = instAudio

    if (showInlineML) {
      for (const { code } of ML_LANGUAGES) {
        const entry = mlEntries[code]
        if (entry.text.trim() && entry.file) {
          files[`multilingual_${code}_audio_file`] = entry.file
        }
      }
    }

    try {
      await createMutation.mutateAsync({ templateType, fields, files })
      navigate('/')
    } catch {
      // Error toast already shown by hook
    }
  }

  const isPending = createMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Content Details ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Content Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="Enter content name"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Content Type <span className="text-destructive">*</span></Label>
            <Controller
              name="contentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Word', 'Sentence', 'Paragraph', 'Char'].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Language <span className="text-destructive">*</span></Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'hi', label: 'Hindi' },
                      { code: 'ta', label: 'Tamil' },
                      { code: 'te', label: 'Telugu' },
                      { code: 'kn', label: 'Kannada' },
                      { code: 'gu', label: 'Gujarati' },
                      { code: 'ma', label: 'Marathi' },
                    ].map(({ code, label }) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Collection</Label>
            <Controller
              name="collectionId"
              control={control}
              render={({ field }) => (
                <CollectionPickerField
                  value={field.value}
                  onChange={field.onChange}
                  defaultLanguage={watch('language')}
                  defaultContentType={watch('contentType')}
                />
              )}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tags <span className="text-destructive">*</span></Label>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <TagInput value={field.value} onChange={field.onChange} placeholder="Type a tag and press Enter" />
              )}
            />
          </div>

        </CardContent>
      </Card>

      {/* ── Read Along Content ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Read Along Content</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="text">Text <span className="text-destructive">*</span></Label>
            <Textarea
              id="text"
              placeholder="Enter the read-along text"
              className="min-h-[80px]"
              {...register('text', { required: 'Text is required' })}
            />
            {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUploadField
              label="Audio File"
              accept="audio/*"
              value={audioFile}
              onChange={setAudioFile}
              hint="Leave empty to auto-generate via TTS"
            />

            <FileUploadField
              label="Image"
              accept="image/*"
              value={imageFile}
              onChange={setImageFile}
              required={imageRequired}
              hint={imageRequired ? undefined : 'Optional'}
            />
          </div>

          {showInstAudio && (
            <FileUploadField
              label="Instruction Audio File"
              accept="audio/*"
              value={instAudio}
              onChange={setInstAudio}
              hint="Leave empty to auto-generate via TTS"
            />
          )}

        </CardContent>
      </Card>

      {/* ── Multilingual Words (M4-M9 & Textbook, English only) ───────────── */}
      {showMLWords && (
        <Card>
          <CardHeader>
            <CardTitle>Multilingual Words</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="multilingual_words">
                Words <span className="text-destructive">*</span>
              </Label>
              <Input
                id="multilingual_words"
                placeholder="e.g. apple, banana, mango"
                {...register('multilingual_words')}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated words that must exist in the Multilingual collection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Multilingual Inline (M1-M2 & M3, English only) ────────────────── */}
      {showInlineML && (
        <Card>
          <CardHeader>
            <CardTitle>Multilingual Translations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {ML_LANGUAGES.map(({ code, label }) => (
              <div key={code} className="space-y-2">
                <p className="text-sm font-medium">{label}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Text in {label}</Label>
                    <Input
                      placeholder={`${label} translation`}
                      value={mlEntries[code].text}
                      onChange={(e) =>
                        setMlEntries((prev) => ({
                          ...prev,
                          [code]: { ...prev[code], text: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <FileUploadField
                    label={`${label} Audio`}
                    accept="audio/*"
                    value={mlEntries[code].file}
                    onChange={(f) =>
                      setMlEntries((prev) => ({
                        ...prev,
                        [code]: { ...prev[code], file: f },
                      }))
                    }
                    hint="Auto-generated if empty"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!watchedText.trim()}
          onClick={() => setPreviewOpen(true)}
        >
          Preview
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating… (may take a moment for TTS)' : 'Create Content'}
        </Button>
      </div>

      <ReadAlongPreviewModal
        content={previewContent}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

    </form>
  )
}
