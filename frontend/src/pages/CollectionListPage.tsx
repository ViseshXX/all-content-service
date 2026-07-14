import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useCollections, useDeleteCollection, COLLECTIONS_KEY } from '@/hooks/useCollections'
import { deleteCollection } from '@/api/collection'
import { useToast } from '@/hooks/use-toast'
import type { Collection } from '@/types'

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

export function CollectionListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: collections, isLoading, isError } = useCollections()
  const deleteMutation = useDeleteCollection()

  const [page, setPage]                     = React.useState(1)
  const [deleteTarget, setDeleteTarget]     = React.useState<Collection | null>(null)
  const [selectedIds, setSelectedIds]       = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkDeleting, setBulkDeleting]     = React.useState(false)

  const total      = collections?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startItem  = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem    = Math.min(page * PAGE_SIZE, total)

  // Items visible on the current page
  const pageItems = (collections ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Clear selection when page changes
  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [page])

  const allSelected  = pageItems.length > 0 && pageItems.every((c) => selectedIds.has(c._id))
  const someSelected = pageItems.some((c) => selectedIds.has(c._id)) && !allSelected

  function toggleSelectAll() {
    if (allSelected) {
      // Deselect current page
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageItems.forEach((c) => next.delete(c._id))
        return next
      })
    } else {
      // Select current page
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageItems.forEach((c) => next.add(c._id))
        return next
      })
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
        await deleteCollection(id)
      } catch {
        failedIds.push(id)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelectedIds(new Set(failedIds))
    queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY })
    if (failedIds.length > 0) {
      toast({
        title: `${failedIds.length} deletion(s) failed`,
        description: 'The highlighted items could not be deleted. Try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collections</h1>
        <Button asChild size="sm">
          <Link to="/collections/new">
            <Plus className="h-4 w-4 mr-1" />
            New Collection
          </Link>
        </Button>
      </div>

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
              Failed to load collections. Check your API token and connection.
            </div>
          ) : !collections?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No collections found.{' '}
              <Link to="/collections/new" className="text-primary underline">
                Create one.
              </Link>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((col) => (
                  <TableRow
                    key={col._id}
                    className={selectedIds.has(col._id) ? 'bg-primary/5' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(col._id)}
                        onCheckedChange={() => toggleOne(col._id)}
                        aria-label={`Select ${col.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <p>{col.name}</p>
                        {col.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {col.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{col.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{col.language}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={col.status === 'live' ? 'success' : 'warning'}>
                        {col.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {col.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(col.tags?.length ?? 0) > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{col.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {col.updatedAt ? new Date(col.updatedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            navigate(`/collections/${col._id}/edit`, { state: { collection: col } })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(col)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {startItem}–{endItem} of {total} collections
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
        title="Delete Collection"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title="Delete Collections"
        description={`Are you sure you want to delete ${selectedIds.size} collection(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        confirmLabel="Delete All"
      />
    </div>
  )
}
