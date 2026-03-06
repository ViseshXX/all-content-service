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
import { ContentSourceDataField } from './ContentSourceDataField'
import { LevelComplexityField } from './LevelComplexityField'
import { MechanicsDataSection } from './MechanicsDataSection'
import { useCollections } from '@/hooks/useCollections'
import type { Content } from '@/types'

const contentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contentType: z.enum(['Word', 'Sentence', 'Paragraph', 'Char']),
  language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'gu']),
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
      // allow pass-through of computed fields
      phonemes: z.array(z.string()).optional(),
      wordCount: z.number().optional(),
      syllableCount: z.number().optional(),
    })
  ).min(1, 'At least one content source entry is required'),
  mechanics_data: z.array(z.any()).optional(),
  multilingual: z.record(z.object({ text: z.string(), audio_url: z.string().optional() })).optional(),
})

export type ContentFormValues = z.infer<typeof contentFormSchema>

interface ContentFormProps {
  mode: 'standard' | 'mechanics'
  defaultValues?: Partial<Content>
  onSubmit: (data: ContentFormValues) => Promise<void>
  isSubmitting?: boolean
}

export function ContentForm({ mode, defaultValues, onSubmit, isSubmitting }: ContentFormProps) {
  const navigate = useNavigate()
  const { data: collections } = useCollections()

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
    formState: { errors },
  } = form

  const tags = watch('tags')

  async function handleFormSubmit(data: ContentFormValues) {
    // Clean up empty optional fields
    const cleaned = { ...data }
    if (!cleaned.collectionId) delete cleaned.collectionId
    if (!cleaned.imagePath) delete cleaned.imagePath
    if (!cleaned.publisher) delete cleaned.publisher
    if (Number.isNaN(cleaned.contentIndex)) delete cleaned.contentIndex
    if (cleaned.level_complexity && !cleaned.level_complexity.level && !cleaned.level_complexity.level_competency && !cleaned.level_complexity.CEFR_level) {
      delete cleaned.level_complexity
    }
    // Strip computed fields from contentSourceData — only send input fields
    cleaned.contentSourceData = cleaned.contentSourceData.map(({ language, text, audioUrl, inst_audioUrl }) => ({
      language,
      text,
      ...(audioUrl ? { audioUrl } : {}),
      ...(inst_audioUrl ? { inst_audioUrl } : {}),
    }))
    if (mode === 'standard') {
      delete cleaned.mechanics_data
    }
    // Preserve multilingual from defaultValues if not modified
    if (!cleaned.multilingual && defaultValues?.multilingual) {
      cleaned.multilingual = defaultValues.multilingual
    }
    await onSubmit(cleaned)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input placeholder="Content name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Publisher</Label>
                <Input placeholder="e.g. Ekstep" {...register('publisher')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
                <Label>Collection</Label>
                <Controller
                  control={control}
                  name="collectionId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select collection (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {collections?.map((c) => (
                          <SelectItem key={c.collectionId} value={c.collectionId}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Content Index</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register('contentIndex', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Image Path</Label>
              <Input placeholder="e.g. image_2.jpg" {...register('imagePath')} />
            </div>

            <div className="space-y-1">
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
            <LevelComplexityField />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ContentSourceDataField />
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
              <MechanicsDataSection />
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : defaultValues ? 'Save Changes' : 'Create Content'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
