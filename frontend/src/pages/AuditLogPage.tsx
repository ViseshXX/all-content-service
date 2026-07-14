import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, type AuditLogListParams } from '@/api/audit-logs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ACTIONS = ['_all', 'CREATE', 'UPDATE', 'DELETE', 'BULK_UPLOAD', 'LOGIN', 'LOGOUT'] as const
const RESOURCES = ['_all', 'content', 'collection', 'multilingual', 'bulk_upload', 'user', 'auth'] as const

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogListParams>({ page: 1, limit: 20 })
  const [action, setAction] = useState('_all')
  const [resource, setResource] = useState('_all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const activeFilters: AuditLogListParams = {
    ...filters,
    ...(action !== '_all' && { action }),
    ...(resource !== '_all' && { resource }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', activeFilters],
    queryFn: () => getAuditLogs(activeFilters),
  })

  const totalPages = data ? Math.ceil(data.total / (filters.limit ?? 20)) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === '_all' ? 'All' : a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Resource</Label>
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === '_all' ? 'All' : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setAction('_all')
            setResource('_all')
            setStartDate('')
            setEndDate('')
            setFilters({ page: 1, limit: 20 })
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data?.data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((log) => (
                <TableRow key={log.auditId}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.actor?.username ?? '—'}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>{log.resource}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {(log as any).resourceName
                      ? <span className="font-medium">{(log as any).resourceName}</span>
                      : <span className="font-mono text-xs text-muted-foreground">{log.resourceId || '—'}</span>
                    }
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">{log.summary || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages} ({data?.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
