import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MechanicsEntryComponent } from './MechanicsEntry'

export function MechanicsDataSection() {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'mechanics_data',
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Mechanics Data</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              mechanics_id: '',
              language: 'en',
              content_body: '',
              text: '',
              jumbled_text: '',
              audio_url: '',
              image_url: '',
              time_limit: undefined,
              options: [],
              hints: { text: '', audio_url: '', image_url: '' },
              correctness: { '50%': [] },
              syllable: [],
              words: [],
              imageAudioMap: [],
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Entry
        </Button>
      </div>

      {fields.map((field, index) => (
        <MechanicsEntryComponent
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
        />
      ))}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
          No mechanics entries. Click "Add Entry" to add one.
        </p>
      )}
    </div>
  )
}
