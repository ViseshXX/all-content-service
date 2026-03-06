import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ContentForm, type ContentFormValues } from '@/components/content/ContentForm'
import { useUpdateContent } from '@/hooks/useContent'
import type { Content } from '@/types'

export function EditContentPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const content = location.state?.content as Content | undefined
  const updateMutation = useUpdateContent()

  // Determine mode from existing data
  const mode =
    content?.mechanics_data && content.mechanics_data.length > 0 ? 'mechanics' : 'standard'

  async function handleSubmit(data: ContentFormValues) {
    if (!id) return
    await updateMutation.mutateAsync({ id, payload: data as Parameters<typeof updateMutation.mutateAsync>[0]['payload'] })
    navigate('/')
  }

  if (!content) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Content not found. Please navigate from the content list.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Edit Content</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ID: <code className="font-mono text-xs">{content.contentId}</code>
        </p>
      </div>
      <ContentForm
        mode={mode}
        defaultValues={content}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
