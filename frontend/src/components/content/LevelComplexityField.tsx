import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function d(isDirty: boolean, isEditMode: boolean) {
  return isEditMode && isDirty ? 'border-l-2 border-red-400 pl-2 bg-red-100 rounded-sm' : ''
}

export function LevelComplexityField({
  prefix = 'level_complexity',
  isEditMode = false,
}: {
  prefix?: string
  isEditMode?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const { register, formState: { dirtyFields } } = useFormContext()
  const lc = (dirtyFields as any).level_complexity ?? {}

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        Level &amp; Complexity
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t px-4 py-4 grid grid-cols-3 gap-4">
          <div className={`space-y-1 ${d(!!lc.level, isEditMode)}`}>
            <Label>Level</Label>
            <Input placeholder="e.g. L1" {...register(`${prefix}.level`)} />
          </div>
          <div className={`space-y-1 ${d(!!lc.level_competency, isEditMode)}`}>
            <Label>Level Competency</Label>
            <Input placeholder="e.g. C1" {...register(`${prefix}.level_competency`)} />
          </div>
          <div className={`space-y-1 ${d(!!lc.CEFR_level, isEditMode)}`}>
            <Label>CEFR Level</Label>
            <Input placeholder="e.g. A1" {...register(`${prefix}.CEFR_level`)} />
          </div>
        </div>
      )}
    </div>
  )
}
