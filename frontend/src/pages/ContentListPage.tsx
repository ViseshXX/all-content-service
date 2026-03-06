import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Filter } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useContentList, useDeleteContent } from '@/hooks/useContent'
import { useCollections } from '@/hooks/useCollections'
import type { ContentType, Language, Content } from '@/types'

const CONTENT_TYPES: ContentType[] = ['Word', 'Sentence', 'Paragraph', 'Char']
const LANGUAGES: Language[] = ['en', 'hi', 'ta', 'te', 'kn', 'gu']
const LIMIT = 20

export function ContentListPage() {
  const navigate = useNavigate()
  const [languageFilter, setLanguageFilter] = React.useState<Language>('en')
  const [typeFilter, setTypeFilter] = React.useState<ContentType | ''>('')
  const [collectionFilter, setCollectionFilter] = React.useState('')
  const [showFilters, setShowFilters] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Content | null>(null)

  const { data: items = [], isLoading, isError } = useContentList({
    language: languageFilter,
    contentType: typeFilter || undefined,
    collectionId: collectionFilter || undefined,
    limit: LIMIT,
  })

  const { data: collections } = useCollections()
  const deleteMutation = useDeleteContent()

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  function resetFilters() {
    setLanguageFilter('en')
    setTypeFilter('')
    setCollectionFilter('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/content/new?mode=standard">
              <Plus className="h-4 w-4 mr-1" />
              Standard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/content/new?mode=mechanics">
              <Plus className="h-4 w-4 mr-1" />
              Mechanics
            </Link>
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filter Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Language *</Label>
                <Select
                  value={languageFilter}
                  onValueChange={(v) => setLanguageFilter(v as Language)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Content Type</Label>
                <Select
                  value={typeFilter || '__all__'}
                  onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v as ContentType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All types</SelectItem>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Collection</Label>
                <Select
                  value={collectionFilter || '__all__'}
                  onValueChange={(v) => setCollectionFilter(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All collections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All collections</SelectItem>
                    {collections?.map((c) => (
                      <SelectItem key={c.collectionId} value={c.collectionId}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">
              Failed to load content. Check your API token and connection.
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No content found.{' '}
              <Link to="/content/new?mode=standard" className="text-primary underline">
                Create one.
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.contentType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.language}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'live' ? 'success' : 'warning'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {item.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(item.tags?.length ?? 0) > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{item.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/content/${item._id}/edit`, { state: { content: item } })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(item)}
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

      <p className="text-sm text-muted-foreground">
        Showing {items.length} items for language: <strong>{languageFilter}</strong>
      </p>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Content"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />
    </div>
  )
}
