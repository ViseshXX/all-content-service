import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { CollectionForm, type CollectionFormValues } from '@/components/collection/CollectionForm'
import { useUpdateCollection } from '@/hooks/useCollections'
import type { Collection } from '@/types'

export function EditCollectionPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const collection = location.state?.collection as Collection | undefined
  const updateMutation = useUpdateCollection()

  async function handleSubmit(data: CollectionFormValues) {
    if (!id) return
    await updateMutation.mutateAsync({ id, payload: data })
    navigate('/collections')
  }

  if (!collection) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Collection not found. Please navigate from the collections list.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Edit Collection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ID: <code className="font-mono text-xs">{collection.collectionId}</code>
        </p>
      </div>
      <CollectionForm
        defaultValues={collection}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
