import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'

const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu']

export function ContentSourceDataField() {
  const { register, control, watch } = useFormContext()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contentSourceData',
  })

  const sourceData = watch('contentSourceData') ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Content Source Data</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ language: 'en', text: '', audioUrl: '', inst_audioUrl: '' })}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Language
        </Button>
      </div>

      {fields.map((field, index) => {
        const item = sourceData[index] ?? {}
        const computedFields = [
          { key: 'phonemes', label: 'Phonemes', value: item.phonemes ? (item.phonemes as string[]).join(', ') : null },
          { key: 'wordCount', label: 'Word Count', value: item.wordCount ?? null },
          { key: 'syllableCount', label: 'Syllable Count', value: item.syllableCount ?? null },
          { key: 'totalOrthoComplexity', label: 'Ortho Complexity', value: item.totalOrthoComplexity ?? null },
          { key: 'totalPhonicComplexity', label: 'Phonic Complexity', value: item.totalPhonicComplexity ?? null },
          { key: 'readingComplexity', label: 'Reading Complexity', value: item.readingComplexity ?? null },
        ].filter((f) => f.value !== null && f.value !== undefined)

        return (
          <div key={field.id} className="border rounded-md p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Entry {index + 1}</span>
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
                  name={`contentSourceData.${index}.language`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Audio URL</Label>
                <Input
                  placeholder="https://..."
                  {...register(`contentSourceData.${index}.audioUrl`)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Text *</Label>
              <Textarea
                placeholder="Enter content text..."
                className="min-h-[80px]"
                {...register(`contentSourceData.${index}.text`)}
              />
            </div>

            <div className="space-y-1">
              <Label>Instruction Audio URL</Label>
              <Input
                placeholder="https://..."
                {...register(`contentSourceData.${index}.inst_audioUrl`)}
              />
            </div>

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
