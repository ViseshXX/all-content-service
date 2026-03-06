import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getContentList,
  fetchContentByIds,
  createContent,
  updateContent,
  deleteContent,
  type ContentListParams,
  type ContentPayload,
} from '@/api/content'
import { toast } from '@/hooks/use-toast'

export function useContentList(params: ContentListParams) {
  return useQuery({
    queryKey: ['content', 'list', params],
    queryFn: () => getContentList(params),
    enabled: !!params.language,
  })
}

export function useContentByIds(ids: string[]) {
  return useQuery({
    queryKey: ['content', 'byIds', ids],
    queryFn: () => fetchContentByIds(ids),
    enabled: ids.length > 0,
  })
}

export function useCreateContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createContent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'list'] })
      toast({ title: 'Content created', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create content'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useUpdateContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContentPayload> }) =>
      updateContent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'list'] })
      toast({ title: 'Content updated', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update content'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useDeleteContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteContent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'list'] })
      toast({ title: 'Content deleted', variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete content'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}
