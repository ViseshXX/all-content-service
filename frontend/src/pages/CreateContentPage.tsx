import { useSearchParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentForm, type ContentFormValues } from '@/components/content/ContentForm'
import { TemplateContentForm, type ReadAlongTemplateType } from '@/components/content/TemplateContentForm'
import { MechanicsContentForm, type MechanicsTemplateType } from '@/components/content/MechanicsContentForm'
import { useCreateContent } from '@/hooks/useContent'

const READ_ALONG_TEMPLATES = new Set<string>([
  'M1 to M2 Read Along Content',
  'M4 to M6 Read Along Content',
  'Textbook image mechanic',
])

const MECHANICS_TEMPLATES = new Set<string>([
  'M1 Mechanics Content',
  'M2 Mechanics Content',
  'M3 Mechanics Content',
  'M4 to M6 Mechanics Content',
  'M10 to M15 Mechanics Content',
])

export function CreateContentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const templateParam = searchParams.get('template') ?? ''
  const modeParam     = (searchParams.get('mode') ?? 'standard') as 'standard' | 'mechanics'

  // Read Along template flow
  if (templateParam && READ_ALONG_TEMPLATES.has(templateParam)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 px-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Content</h1>
            <p className="text-muted-foreground text-sm">{templateParam}</p>
          </div>
        </div>
        <TemplateContentForm templateType={templateParam as ReadAlongTemplateType} />
      </div>
    )
  }

  // Mechanics template flow
  if (templateParam && MECHANICS_TEMPLATES.has(templateParam)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 px-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Content</h1>
            <p className="text-muted-foreground text-sm">{templateParam}</p>
          </div>
        </div>
        <MechanicsContentForm templateType={templateParam as MechanicsTemplateType} />
      </div>
    )
  }

  // Legacy mode-based flow (Standard / Mechanics) — kept for backward compatibility
  const createMutation = useCreateContent()

  async function handleSubmit(data: ContentFormValues) {
    await createMutation.mutateAsync(data as Parameters<typeof createMutation.mutateAsync>[0])
    navigate('/')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create {modeParam === 'mechanics' ? 'Mechanics' : 'Standard'} Content</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {modeParam === 'mechanics'
            ? 'Create interactive exercise content with MCQ, fill-in-blanks, match options, etc.'
            : 'Create a standard content item (word, sentence, paragraph, or character).'}
        </p>
      </div>
      <ContentForm
        mode={modeParam}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
      />
    </div>
  )
}
