import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MechanicsEntryComponent } from './MechanicsEntry'

const M1_M2_M3_IDS = new Set(['M1_L', 'M2_L', 'M3_L'])
const M4_M9_TYPES  = new Set(['mechanic_1', 'mechanic_2', 'mechanic_3'])

export function MechanicsDataSection({ isEditMode = false }: { isEditMode?: boolean }) {
  const { control, watch } = useFormContext()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'mechanics_data',
  })

  // Hide "Add Entry" when any entry is an M1/M2/M3 mechanic — their structure is fixed
  const mechanicsData = watch('mechanics_data') ?? []
  const hasM1M2M3 = (mechanicsData as any[]).some((m) => M1_M2_M3_IDS.has(m.mechanics_id))

  // For M4-M9: each of mechanic_1, mechanic_2, mechanic_3 can appear at most once.
  // Hide "Add Entry" once all three slots are occupied.
  const existingM4M9Types = new Set(
    (mechanicsData as any[])
      .map((m) => m.mechanics_id)
      .filter((id) => M4_M9_TYPES.has(id)),
  )
  const allM4M9SlotsFilled = existingM4M9Types.size >= 3

  // For M4-M9 mechanics: at least one of mechanic_1 or mechanic_2 must always remain.
  // mechanic_3 is optional and can always be removed.
  const m1m2Count = (mechanicsData as any[]).filter(
    (m) => m.mechanics_id === 'mechanic_1' || m.mechanics_id === 'mechanic_2',
  ).length

  function canRemoveEntry(index: number): boolean {
    const id = (mechanicsData as any[])[index]?.mechanics_id
    if (id === 'mechanic_1' || id === 'mechanic_2') return m1m2Count > 1
    return true
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Mechanics Data</Label>
        {!hasM1M2M3 && !allM4M9SlotsFilled && (
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
        )}
      </div>

      {fields.map((field, index) => (
        <MechanicsEntryComponent
          key={field.id}
          index={index}
          isEditMode={isEditMode}
          onRemove={() => remove(index)}
          canRemove={canRemoveEntry(index)}
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
