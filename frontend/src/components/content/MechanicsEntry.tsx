import * as React from 'react'
import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/shared/TagInput'

const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu']

interface MechanicsEntryProps {
  index: number
  onRemove: () => void
}

export function MechanicsEntryComponent({ index, onRemove }: MechanicsEntryProps) {
  const [open, setOpen] = React.useState(true)
  const { register, control, watch, setValue } = useFormContext()

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

  const words = watch(`${basePath}.words`) ?? []
  const correctness50 = watch(`${basePath}.correctness.50%`) ?? []

  return (
    <div className="border rounded-md bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30"
      >
        <span>Entry {index + 1}: {watch(`${basePath}.mechanics_id`) || '(no id)'}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Mechanics ID *</Label>
              <Input placeholder="e.g. MCQ_1" {...register(`${basePath}.mechanics_id`)} />
            </div>
            <div className="space-y-1">
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

          <div className="space-y-1">
            <Label>Content Body</Label>
            <Textarea placeholder="Main content body..." {...register(`${basePath}.content_body`)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Text</Label>
              <Input placeholder="Display text" {...register(`${basePath}.text`)} />
            </div>
            <div className="space-y-1">
              <Label>Jumbled Text</Label>
              <Input placeholder="For reordering exercises" {...register(`${basePath}.jumbled_text`)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Audio URL</Label>
              <Input placeholder="https://..." {...register(`${basePath}.audio_url`)} />
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input placeholder="https://..." {...register(`${basePath}.image_url`)} />
            </div>
            <div className="space-y-1">
              <Label>Time Limit (s)</Label>
              <Input type="number" placeholder="30" {...register(`${basePath}.time_limit`, { valueAsNumber: true })} />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
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
            {optionFields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-end border rounded p-2 bg-background">
                <div className="space-y-1">
                  <Label className="text-xs">Text</Label>
                  <Input size={1} {...register(`${basePath}.options.${i}.text`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audio URL</Label>
                  <Input size={1} {...register(`${basePath}.options.${i}.audio_url`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Image URL</Label>
                  <Input size={1} {...register(`${basePath}.options.${i}.image_url`)} />
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <Label className="text-xs">Is Ans</Label>
                  <Controller
                    control={control}
                    name={`${basePath}.options.${i}.isAns`}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeOption(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Hints */}
          <div className="border rounded-md p-3 space-y-2">
            <Label className="font-semibold">Hints</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Text</Label>
                <Input {...register(`${basePath}.hints.text`)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Audio URL</Label>
                <Input {...register(`${basePath}.hints.audio_url`)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input {...register(`${basePath}.hints.image_url`)} />
              </div>
            </div>
          </div>

          {/* Correctness 50% */}
          <div className="space-y-1">
            <Label>Correctness (50%)</Label>
            <TagInput
              value={correctness50}
              onChange={(v) => setValue(`${basePath}.correctness.50%`, v)}
              placeholder="Add items..."
            />
          </div>

          {/* Words */}
          <div className="space-y-1">
            <Label>Words</Label>
            <TagInput
              value={words}
              onChange={(v) => setValue(`${basePath}.words`, v)}
              placeholder="Add words..."
            />
          </div>

          {/* Syllable */}
          <div className="space-y-2">
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
            {syllableFields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Text</Label>
                  <Input {...register(`${basePath}.syllable.${i}.text`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audio URL</Label>
                  <Input {...register(`${basePath}.syllable.${i}.audio_url`)} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSyllable(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Image Audio Map */}
          <div className="space-y-2">
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
            {imageAudioFields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end border rounded p-2">
                <div className="space-y-1">
                  <Label className="text-xs">Text</Label>
                  <Input {...register(`${basePath}.imageAudioMap.${i}.text`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Multilingual ID</Label>
                  <Input {...register(`${basePath}.imageAudioMap.${i}.multilingual_id`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audio URL</Label>
                  <Input {...register(`${basePath}.imageAudioMap.${i}.audio_url`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Image URL</Label>
                  <Input {...register(`${basePath}.imageAudioMap.${i}.image_url`)} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeImageAudio(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
