import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ReadAlongTemplateType } from './TemplateContentForm'
import type { MechanicsTemplateType } from './MechanicsContentForm'

// ─────────────────────────────────────────────────────────────────────────────

const READ_ALONG_TEMPLATES: { type: ReadAlongTemplateType; label: string }[] = [
  { type: 'M1 to M2 Read Along Content', label: 'M1–M3 Read Along' },
  { type: 'M4 to M6 Read Along Content', label: 'M4–M9 Read Along' },
  { type: 'Textbook image mechanic',     label: 'Textbook Passage Read Along' },
]

const MECHANICS_TEMPLATES: { type: MechanicsTemplateType; label: string }[] = [
  { type: 'M1 Mechanics Content',         label: 'M1 Mechanics' },
  { type: 'M2 Mechanics Content',         label: 'M2 Mechanics' },
  { type: 'M3 Mechanics Content',         label: 'M3 Mechanics' },
  { type: 'M4 to M6 Mechanics Content',  label: 'M4–M9 Mechanics' },
  { type: 'M10 to M15 Mechanics Content', label: 'M10–M15 Mechanics' },
]

// ─────────────────────────────────────────────────────────────────────────────

export function TemplatePickerDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  function handleSelect(templateType: string) {
    setOpen(false)
    navigate(`/content/new?template=${encodeURIComponent(templateType)}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select a Template</DialogTitle>
        </DialogHeader>

        {/* ── Read Along ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Read Along
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {READ_ALONG_TEMPLATES.map((tpl) => (
              <button
                key={tpl.type}
                type="button"
                onClick={() => handleSelect(tpl.type)}
                className="text-left rounded-lg border p-3 hover:bg-accent hover:border-primary/50 transition-colors"
              >
                <p className="text-sm font-medium">{tpl.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mechanics ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Mechanics
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MECHANICS_TEMPLATES.map((tpl) => (
              <button
                key={tpl.type}
                type="button"
                onClick={() => handleSelect(tpl.type)}
                className="text-left rounded-lg border p-3 hover:bg-accent hover:border-primary/50 transition-colors"
              >
                <p className="text-sm font-medium">{tpl.label}</p>
              </button>
            ))}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
