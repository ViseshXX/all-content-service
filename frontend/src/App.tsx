import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { BookOpen, Layers } from 'lucide-react'
import { ContentListPage } from '@/pages/ContentListPage'
import { CreateContentPage } from '@/pages/CreateContentPage'
import { EditContentPage } from '@/pages/EditContentPage'
import { CollectionListPage } from '@/pages/CollectionListPage'
import { CreateCollectionPage } from '@/pages/CreateCollectionPage'
import { EditCollectionPage } from '@/pages/EditCollectionPage'
import { TokenSettings } from '@/components/shared/TokenSettings'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'
import { toast } from '@/hooks/use-toast'

export default function App() {
  useEffect(() => {
    function handleUnauthorized() {
      toast({
        title: 'Unauthorized',
        description: 'Your token may be invalid or expired. Update it via the settings icon.',
        variant: 'destructive',
      })
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              ALL Content
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  Content
                </span>
              </NavLink>
              <NavLink
                to="/collections"
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  Collections
                </span>
              </NavLink>
            </nav>
          </div>
          <TokenSettings />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<ContentListPage />} />
          <Route path="/content/new" element={<CreateContentPage />} />
          <Route path="/content/:id/edit" element={<EditContentPage />} />
          <Route path="/collections" element={<CollectionListPage />} />
          <Route path="/collections/new" element={<CreateCollectionPage />} />
          <Route path="/collections/:id/edit" element={<EditCollectionPage />} />
        </Routes>
      </main>

      <Toaster />
    </div>
  )
}
