import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
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
import { AssetUploadField, flushPendingUploads } from '@/components/content/AssetUploadField'
import { toast } from '@/hooks/use-toast'
import { useCreateMultilingual } from '@/hooks/useMultilingual'

const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma'] as const

const LANG_NAMES: Record<string, string> = {
  hi: 'Hindi',
  te: 'Telugu',
  kn: 'Kannada',
  ta: 'Tamil',
  gu: 'Gujarati',
  ma: 'Marathi',
  en: 'English',
}

const schema = z.object({
  multilingual_id: z.string().min(1, 'Multilingual ID is required'),
  entries: z
    .array(
      z.object({
        language:  z.enum(LANGUAGES),
        text:      z.string().min(1, 'Text is required'),
        audio_url: z.string().optional(),
        image_url: z.string().optional(),
      }),
    )
    .min(1, 'Add at least one language entry'),
})

type FormValues = z.infer<typeof schema>


export function CreateMultilingualPage() {
  const navigate       = useNavigate()
  const createMutation = useCreateMultilingual()

  const { register, control, handleSubmit, watch, getValues, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        multilingual_id: '',
        entries: [{ language: 'hi', text: '', audio_url: '', image_url: '' }],
      },
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'entries' })
  const watchedEntries = watch('entries')

  async function onSubmit(data: FormValues) {
    try {
      await flushPendingUploads()
      data = getValues()
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.response?.data?.message ?? err?.message ?? 'File upload failed. Please try again.', variant: 'destructive' })
      return
    }
    const multilingual: Record<string, { text: string; audio_url?: string; image_url?: string }> = {}
    for (const entry of data.entries) {
      multilingual[entry.language] = {
        text:      entry.text,
        ...(entry.audio_url ? { audio_url: entry.audio_url } : {}),
        ...(entry.image_url ? { image_url: entry.image_url } : {}),
      }
    }
    await createMutation.mutateAsync({ multilingual_id: data.multilingual_id, multilingual })
    navigate('/multilingual')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create Multilingual Entry</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add translations for a word or phrase across multiple languages.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ID */}
        <Card>
          <CardHeader>
            <CardTitle>Identifier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-w-sm">
              <Label>Multilingual ID *</Label>
              <Input
                placeholder="e.g. lunch, TEACHER, fish"
                {...register('multilingual_id')}
              />
              {errors.multilingual_id && (
                <p className="text-xs text-destructive">{errors.multilingual_id.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Language entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Language Entries</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ language: 'hi', text: '', audio_url: '', image_url: '' })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Language
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                No language entries. Click "Add Language" to add one.
              </p>
            )}

            {fields.map((field, index) => {
              const item = watchedEntries[index] ?? {}
              const entryErrors = errors.entries?.[index]
              return (
                <div key={field.id} className="border rounded-md p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {LANG_NAMES[item.language ?? ''] ?? item.language ?? `Entry ${index + 1}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Language *</Label>
                      <Controller
                        control={control}
                        name={`entries.${index}.language`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map((l) => (
                                <SelectItem key={l} value={l}>
                                  {LANG_NAMES[l]} ({l})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Text *</Label>
                      <Input
                        placeholder="Translation text"
                        {...register(`entries.${index}.text`)}
                      />
                      {entryErrors?.text && (
                        <p className="text-xs text-destructive">{entryErrors.text.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Audio</Label>
                      <Controller
                        control={control}
                        name={`entries.${index}.audio_url`}
                        render={({ field }) => (
                          <AssetUploadField
                            assetType="audio"
                            value={field.value}
                            onChange={field.onChange}
                            language={item.language}
                            audioType="multilingual"
                            audioFolder="multilingual_audios"
                            fieldName={field.name}
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Image</Label>
                      <Controller
                        control={control}
                        name={`entries.${index}.image_url`}
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
                  </div>
                </div>
              )
            })}

            {errors.entries?.message && (
              <p className="text-xs text-destructive">{errors.entries.message}</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/multilingual')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Entry'}
          </Button>
        </div>
      </form>
    </div>
  )
}
