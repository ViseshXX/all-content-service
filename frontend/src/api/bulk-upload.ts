import { apiClient } from './client'
import type { WizardConfig, JobStatus } from '@/types'

export async function submitBulkUpload(
  file: File,
  wizard: WizardConfig,
): Promise<{ jobId: string; totalRows: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('wizard', JSON.stringify(wizard))

  const res = await apiClient.post('/content/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
  })
  return res.data
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await apiClient.get(`/content/bulk-upload/status/${jobId}`)
  return res.data
}

export async function resumeJob(jobId: string): Promise<{ message: string }> {
  const res = await apiClient.post(`/content/bulk-upload/resume/${jobId}`)
  return res.data
}
