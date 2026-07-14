import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchMultilingualList,
  fetchMultilingualById,
  createMultilingual,
  updateMultilingual,
  deleteMultilingual,
  type MultilingualPayload,
} from '@/api/multilingual'
import { toast } from '@/hooks/use-toast'

export const MULTILINGUAL_KEY = ['multilingual'] as const

export function useMultilingualList(search: string, page: number) {
  return useQuery({
    queryKey: [...MULTILINGUAL_KEY, search, page],
    queryFn: () => fetchMultilingualList(search || undefined, 20, page),
  })
}

export function useMultilingualEntry(id: string) {
  return useQuery({
    queryKey: [...MULTILINGUAL_KEY, id],
    queryFn: () => fetchMultilingualById(id),
    enabled: !!id,
  })
}

export function useCreateMultilingual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMultilingual,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MULTILINGUAL_KEY })
      toast({ title: 'Multilingual entry created', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create multilingual entry'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useUpdateMultilingual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MultilingualPayload> }) =>
      updateMultilingual(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: MULTILINGUAL_KEY })
      qc.invalidateQueries({ queryKey: [...MULTILINGUAL_KEY, id] })
      toast({ title: 'Multilingual entry updated', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update multilingual entry'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useDeleteMultilingual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMultilingual,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MULTILINGUAL_KEY })
      toast({ title: 'Multilingual entry deleted', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete multilingual entry'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}
