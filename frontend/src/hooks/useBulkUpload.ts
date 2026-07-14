import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submitBulkUpload, getJobStatus, resumeJob } from '@/api/bulk-upload'
import type { WizardConfig } from '@/types'
import { toast } from '@/hooks/use-toast'

export function useSubmitBulkUpload() {
  return useMutation({
    mutationFn: ({ file, wizard }: { file: File; wizard: WizardConfig }) =>
      submitBulkUpload(file, wizard),
    onSuccess: (data) => {
      toast({ title: 'Upload accepted', description: `Job ${data.jobId} — ${data.totalRows} row(s)`, variant: 'success' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Bulk upload failed'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['bulk-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PROCESSING' || status === 'PENDING' ? 3000 : false
    },
    enabled: !!jobId,
  })
}

export function useResumeJob(jobId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resumeJob,
    onSuccess: (data) => {
      toast({ title: 'Job resumed', description: data.message, variant: 'success' })
      // Invalidate the cached query so polling restarts from a fresh state
      queryClient.invalidateQueries({ queryKey: ['bulk-job', jobId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to resume job'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })
}
