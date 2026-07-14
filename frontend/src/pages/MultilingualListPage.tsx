import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useMultilingualList, useDeleteMultilingual, MULTILINGUAL_KEY } from '@/hooks/useMultilingual'
import { deleteMultilingual } from '@/api/multilingual'
import { useToast } from '@/hooks/use-toast'
import type { MultilingualEntry } from '@/types'

const PAGE_SIZE = 20

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

export function MultilingualListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch]             = React.useState('')
  const [debouncedSearch, setDebounced] = React.useState('')
  const [page, setPage]                 = React.useState(1)
  const [deleteTarget, setDeleteTarget] = React.useState<MultilingualEntry | null>(null)
  const [selectedIds, setSelectedIds]   = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting]     = React.useState(false)

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Clear selection when page or search changes
  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [page, debouncedSearch])

  const { data, isLoading, isError } = useMultilingualList(debouncedSearch, page)
  const deleteMutation = useDeleteMultilingual()

  const items      = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startItem  = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem    = Math.min(page * PAGE_SIZE, total)

  const allSelected  = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && !allSelected

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((e) => e._id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const failedIds: string[] = []
    for (const id of ids) {
      try {
        await deleteMultilingual(id)
      } catch {
        failedIds.push(id)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelectedIds(new Set(failedIds))
    queryClient.invalidateQueries({ queryKey: MULTILINGUAL_KEY })
    if (failedIds.length > 0) {
      toast({
        title: `${failedIds.length} deletion(s) failed`,
        description: 'The highlighted items could not be deleted. Try again.',
        variant: 'destructive',
      })
    }
  }

  // Get available language codes from an entry (excluding 'content_id')
  function getLangs(entry: MultilingualEntry): string[] {
    return Object.keys(entry.multilingual ?? {}).filter((k) => k !== 'content_id')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Multilingual</h1>
        <Button asChild size="sm">
          <Link to="/multilingual/new">
            <Plus className="h-4 w-4 mr-1" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">
              Failed to load multilingual entries. Check your API token and connection.
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No multilingual entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? 'indeterminate' : undefined}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                  <TableHead>Multilingual ID</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => {
                  const langs = getLangs(entry)
                  return (
                    <TableRow
                      key={entry._id}
                      className={selectedIds.has(entry._id) ? 'bg-primary/5' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(entry._id)}
                          onCheckedChange={() => toggleOne(entry._id)}
                          aria-label={`Select ${entry.multilingual_id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono">{entry.multilingual_id}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {langs.map((l) => (
                            <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              navigate(`/multilingual/${entry._id}/edit`, { state: { entry } })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {startItem}–{endItem} of {total} entries
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {buildPageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Multilingual Entry"
        description={`Are you sure you want to delete "${deleteTarget?.multilingual_id}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title="Delete Multilingual Entries"
        description={`Are you sure you want to delete ${selectedIds.size} entry(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        confirmLabel="Delete All"
      />
    </div>
  )
}
