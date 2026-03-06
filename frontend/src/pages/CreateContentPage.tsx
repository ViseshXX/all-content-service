import { useSearchParams, useNavigate } from 'react-router-dom'
import { ContentForm, type ContentFormValues } from '@/components/content/ContentForm'
import { useCreateContent } from '@/hooks/useContent'

export function CreateContentPage() {
  const [searchParams] = useSearchParams()
  const mode = (searchParams.get('mode') ?? 'standard') as 'standard' | 'mechanics'
  const navigate = useNavigate()
  const createMutation = useCreateContent()

  async function handleSubmit(data: ContentFormValues) {
    await createMutation.mutateAsync(data as Parameters<typeof createMutation.mutateAsync>[0])
    navigate('/')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create {mode === 'mechanics' ? 'Mechanics' : 'Standard'} Content</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === 'mechanics'
            ? 'Create interactive exercise content with MCQ, fill-in-blanks, match options, etc.'
            : 'Create a standard content item (word, sentence, paragraph, or character).'}
        </p>
      </div>
      <ContentForm
        mode={mode}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
      />
    </div>
  )
}
