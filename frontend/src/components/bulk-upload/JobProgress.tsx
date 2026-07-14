import * as React from 'react'
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, UploadCloud, Copy, Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJobStatus, useResumeJob } from '@/hooks/useBulkUpload'

interface JobProgressProps {
  jobId: string
  onStartOver?: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms <= 0) return null
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem  = secs % 60
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`
}

function downloadErrorCsv(failedRowDetails: { rowIndex: number; sheetName: string; error: string }[]) {
  const header = 'Row,Sheet,Error'
  const rows   = failedRowDetails.map(
    (d) => `${d.rowIndex},"${d.sheetName}","${d.error.replace(/"/g, '""')}"`,
  )
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'bulk-upload-errors.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function JobProgress({ jobId, onStartOver }: JobProgressProps) {
  const { data: job, isLoading } = useJobStatus(jobId)
  const resumeMutation = useResumeJob(jobId)

  if (isLoading || !job) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading job status...</p>
  }

  const isActive      = job.status === 'PROCESSING' || job.status === 'PENDING'
  const resumeCount   = job.resumeCount ?? 0
  const successRows   = job.totalRows - (job.failedRows ?? 0)
  const pct           = job.totalRows > 0
    ? Math.min(100, Math.round((job.processedRows / job.totalRows) * 100))
    : 0
  const duration      = formatDuration(job.createdAt, job.updatedAt)

  const isValidationFailure = job.status === 'FAILED' && job.processedRows === 0
  const maxRetriesReached   = !isActive && resumeCount >= 2 && job.failedRows > 0
  const canResume =
    !isValidationFailure &&
    !maxRetriesReached &&
    resumeCount < 2 &&
    (job.status === 'FAILED' || (job.status === 'COMPLETED' && job.failedRows > 0))

  const isTerminal = !isActive

  function StatusIcon({ status, failedRows }: { status: string; failedRows: number }) {
    if (isActive) return <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
    if (status === 'COMPLETED' && failedRows === 0) return <CheckCircle2 className="h-3 w-3 inline mr-1" />
    if (status === 'FAILED' || failedRows > 0) return <AlertTriangle className="h-3 w-3 inline mr-1" />
    return null
  }

  const badgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    PENDING:    'secondary',
    PROCESSING: 'default',
    COMPLETED:  'outline',
    FAILED:     'destructive',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Job Progress</span>
          <Badge variant={badgeVariant[job.status] ?? 'secondary'}>
            <StatusIcon status={job.status} failedRows={job.failedRows} />
            {job.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Template label ───────────────────────────────────────── */}
        {job.templateType && (
          <p className="text-sm text-muted-foreground">
            Template: <span className="font-medium text-foreground">{job.templateType}</span>
          </p>
        )}

        {/* ── Progress bar ─────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {job.processedRows} / {job.totalRows} rows
            </span>
            <span className="font-medium">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className={`h-full rounded-full bg-primary transition-all ${isActive ? 'animate-pulse' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* ── Completion summary (shown only when job has settled) ───── */}
        {isTerminal && (
          <div className={`rounded-md p-3 text-sm ${
            job.status === 'COMPLETED' && job.failedRows === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            {job.status === 'COMPLETED' && job.failedRows === 0 ? (
              <p className="font-medium text-green-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {successRows} row{successRows !== 1 ? 's' : ''} ingested successfully
                {duration && <span className="font-normal text-green-700"> · {duration}</span>}
              </p>
            ) : (
              <p className="font-medium text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {job.failedRows > 0
                  ? `${successRows} / ${job.totalRows} rows ingested — ${job.failedRows} failed`
                  : 'Job ended with errors'}
                {duration && <span className="font-normal text-amber-700"> · {duration}</span>}
              </p>
            )}
          </div>
        )}

        {/* ── Collection info (shown when a collection was used/created) ─ */}
        {isTerminal && job.resultCollectionId && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collection</p>
            {job.resultCollectionName && (
              <div className="flex items-center text-sm">
                <span className="font-medium">{job.resultCollectionName}</span>
              </div>
            )}
            <div className="flex items-center text-xs text-muted-foreground font-mono">
              <span className="truncate">{job.resultCollectionId}</span>
              <CopyButton text={job.resultCollectionId} />
            </div>
            <Link
              to="/collections"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
            >
              <ExternalLink className="h-3 w-3" />
              View Collections
            </Link>
          </div>
        )}

        {/* ── Top-level error message ───────────────────────────────── */}
        {job.errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
            {job.errorMessage}
          </p>
        )}

        {/* ── Condition B: max retries warning ─────────────────────── */}
        {maxRetriesReached && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
            The highlighted rows failed after multiple attempts. The downstream service might be
            unavailable. Please try again later.
          </p>
        )}

        {/* ── Action buttons ────────────────────────────────────────── */}
        {isTerminal && (
          <div className="flex flex-wrap gap-2">
            {canResume && (
              <Button
                variant="destructive"
                disabled={resumeMutation.isPending}
                onClick={() => resumeMutation.mutate(jobId)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {resumeMutation.isPending ? 'Resuming...' : 'Resume Failed Rows'}
              </Button>
            )}
            {job.failedRowDetails && job.failedRowDetails.length > 0 && (
              <Button variant="outline" onClick={() => downloadErrorCsv(job.failedRowDetails)}>
                Download Error Report
              </Button>
            )}
            <Button variant="outline" onClick={onStartOver}>
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload Another File
            </Button>
          </div>
        )}

        {/* ── Per-row error list (capped at 50 to protect the DOM) ─── */}
        {job.failedRowDetails && job.failedRowDetails.length > 0 && (() => {
          const MAX_SHOWN = 50
          const shown     = job.failedRowDetails.slice(0, MAX_SHOWN)
          const remaining = job.failedRowDetails.length - shown.length
          return (
            <div className="rounded border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Row Errors ({job.failedRowDetails.length})
              </p>
              <ul className="space-y-1 list-none overflow-y-auto max-h-60">
                {shown.map((detail) => (
                  <li
                    key={`${detail.sheetName}-${detail.rowIndex}`}
                    className="text-xs text-destructive break-words"
                  >
                    <span className="font-medium">Row {detail.rowIndex}:</span> {detail.error}
                  </li>
                ))}
                {remaining > 0 && (
                  <li className="text-xs text-muted-foreground italic pt-1 border-t">
                    …and {remaining} more error{remaining === 1 ? '' : 's'}. Please check your Excel formatting.
                  </li>
                )}
              </ul>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
