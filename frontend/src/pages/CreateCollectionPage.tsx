import { useNavigate } from 'react-router-dom'
import { CollectionForm, type CollectionFormValues } from '@/components/collection/CollectionForm'
import { useCreateCollection } from '@/hooks/useCollections'

export function CreateCollectionPage() {
  const navigate = useNavigate()
  const createMutation = useCreateCollection()

  async function handleSubmit(data: CollectionFormValues) {
    await createMutation.mutateAsync(data)
    navigate('/collections')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create Collection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a new collection to group related content items.
        </p>
      </div>
      <CollectionForm onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
    </div>
  )
}
