import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TagInput } from '@/components/shared/TagInput'
import type { Collection } from '@/types'
import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['Word', 'Sentence', 'Paragraph', 'Char']),
  language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'gu']),
  status: z.enum(['live', 'draft']),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  description: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  edition: z.string().optional(),
  imagePath: z.string().optional(),
  difficultyLevel: z.string().optional(),
  ageGroup: z.string().optional(),
  level_complexity: z
    .object({
      level: z.string().optional(),
      level_competency: z.string().optional(),
      CEFR_level: z.string().optional(),
    })
    .optional(),
})

export type CollectionFormValues = z.infer<typeof collectionFormSchema>

interface CollectionFormProps {
  defaultValues?: Partial<Collection>
  onSubmit: (data: CollectionFormValues) => Promise<void>
  isSubmitting?: boolean
}

export function CollectionForm({ defaultValues, onSubmit, isSubmitting }: CollectionFormProps) {
  const navigate = useNavigate()
  const [showLevel, setShowLevel] = React.useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      category: defaultValues?.category ?? 'Word',
      language: defaultValues?.language ?? 'en',
      status: defaultValues?.status ?? 'draft',
      tags: defaultValues?.tags ?? [],
      description: defaultValues?.description ?? '',
      author: defaultValues?.author ?? '',
      publisher: defaultValues?.publisher ?? '',
      edition: defaultValues?.edition ?? '',
      imagePath: defaultValues?.imagePath ?? '',
      difficultyLevel: defaultValues?.difficultyLevel ?? '',
      ageGroup: defaultValues?.ageGroup ?? '',
      level_complexity: defaultValues?.level_complexity ?? {
        level: '',
        level_competency: '',
        CEFR_level: '',
      },
    },
  })

  const tags = watch('tags')

  async function handleFormSubmit(data: CollectionFormValues) {
    const cleaned = { ...data }
    if (!cleaned.description) delete cleaned.description
    if (!cleaned.author) delete cleaned.author
    if (!cleaned.publisher) delete cleaned.publisher
    if (!cleaned.edition) delete cleaned.edition
    if (!cleaned.imagePath) delete cleaned.imagePath
    if (!cleaned.difficultyLevel) delete cleaned.difficultyLevel
    if (!cleaned.ageGroup) delete cleaned.ageGroup
    if (
      cleaned.level_complexity &&
      !cleaned.level_complexity.level &&
      !cleaned.level_complexity.level_competency &&
      !cleaned.level_complexity.CEFR_level
    ) {
      delete cleaned.level_complexity
    }
    await onSubmit(cleaned)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input placeholder="e.g. Grade 2 English Chapter 3" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea placeholder="Optional description..." {...register('description')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Category *</Label>
              <Controller
                control={control}
                name="category"
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Author</Label>
              <Input placeholder="e.g. Ekstep" {...register('author')} />
            </div>
            <div className="space-y-1">
              <Label>Publisher</Label>
              <Input placeholder="e.g. NCERT" {...register('publisher')} />
            </div>
            <div className="space-y-1">
              <Label>Edition</Label>
              <Input placeholder="e.g. 2024" {...register('edition')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Difficulty Level</Label>
              <Input placeholder="e.g. Beginner" {...register('difficultyLevel')} />
            </div>
            <div className="space-y-1">
              <Label>Age Group</Label>
              <Input placeholder="e.g. 6-8" {...register('ageGroup')} />
            </div>
            <div className="space-y-1">
              <Label>Image Path</Label>
              <Input placeholder="e.g. cover.jpg" {...register('imagePath')} />
            </div>
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

      {/* Level Complexity collapsible */}
      <div className="border rounded-md">
        <button
          type="button"
          onClick={() => setShowLevel((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
        >
          Level &amp; Complexity
          {showLevel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {showLevel && (
          <div className="border-t px-4 py-4 grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Level</Label>
              <Input placeholder="e.g. L1" {...register('level_complexity.level')} />
            </div>
            <div className="space-y-1">
              <Label>Level Competency</Label>
              <Input placeholder="e.g. C1" {...register('level_complexity.level_competency')} />
            </div>
            <div className="space-y-1">
              <Label>CEFR Level</Label>
              <Input placeholder="e.g. A1" {...register('level_complexity.CEFR_level')} />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => navigate('/collections')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : defaultValues?.name ? 'Save Changes' : 'Create Collection'}
        </Button>
      </div>
    </form>
  )
}
