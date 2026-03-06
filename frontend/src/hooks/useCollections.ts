import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCollections,
  fetchCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  type CollectionPayload,
} from '@/api/collection'
import { toast } from '@/hooks/use-toast'

export const COLLECTIONS_KEY = ['collections'] as const

export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: fetchCollections,
  })
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () => fetchCollectionById(id),
    enabled: !!id,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_KEY })
      toast({ title: 'Collection created', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create collection'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CollectionPayload> }) =>
      updateCollection(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_KEY })
      qc.invalidateQueries({ queryKey: ['collection', id] })
      toast({ title: 'Collection updated', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update collection'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_KEY })
      toast({ title: 'Collection deleted', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete collection'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}
