import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useCollections, useDeleteCollection } from '@/hooks/useCollections'
import type { Collection } from '@/types'

export function CollectionListPage() {
  const navigate = useNavigate()
  const { data: collections, isLoading, isError } = useCollections()
  const deleteMutation = useDeleteCollection()
  const [deleteTarget, setDeleteTarget] = React.useState<Collection | null>(null)

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    })
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
                {collections.map((col) => (
                  <TableRow key={col._id}>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Collection"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />
    </div>
  )
}
