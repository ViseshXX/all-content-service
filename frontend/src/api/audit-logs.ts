import { apiClient } from './client'

export interface AuditLogEntry {
  auditId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPLOAD' | 'LOGIN' | 'LOGOUT'
  resource: 'content' | 'collection' | 'multilingual' | 'bulk_upload' | 'user' | 'auth'
  resourceId?: string
  actor: { virtualId: number; username: string; role: string }
  changes?: Record<string, { from: any; to: any }>
  summary?: string
  ipAddress?: string
  timestamp: string
}

export interface AuditLogListParams {
  userId?: number
  action?: string
  resource?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface AuditLogListResult {
  data: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export async function getAuditLogs(params: AuditLogListParams = {}): Promise<AuditLogListResult> {
  const res = await apiClient.get('/audit-logs', { params })
  return res.data
}

export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string
): Promise<AuditLogEntry[]> {
  const res = await apiClient.get(`/audit-logs/${resourceType}/${resourceId}`)
  return res.data.data
}
