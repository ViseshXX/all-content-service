import { useEffect } from 'react'
import { Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import { BookOpen, Layers, Upload, Languages, LogOut, Users, ClipboardList } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchCollections } from '@/api/collection'
import { COLLECTIONS_KEY } from '@/hooks/useCollections'
import { ContentListPage } from '@/pages/ContentListPage'
import { CreateContentPage } from '@/pages/CreateContentPage'
import { EditContentPage } from '@/pages/EditContentPage'
import { CollectionListPage } from '@/pages/CollectionListPage'
import { CreateCollectionPage } from '@/pages/CreateCollectionPage'
import { EditCollectionPage } from '@/pages/EditCollectionPage'
import { MultilingualListPage } from '@/pages/MultilingualListPage'
import { EditMultilingualPage } from '@/pages/EditMultilingualPage'
import { CreateMultilingualPage } from '@/pages/CreateMultilingualPage'
import { BulkUploadPage } from '@/pages/BulkUploadPage'
import { LoginPage } from '@/pages/LoginPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'px-3 py-1.5 rounded-md text-sm transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground font-medium'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
  )
}

function AppShell() {
  const { user, isAdmin, logout, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isAuthenticated) {
      queryClient.prefetchQuery({ queryKey: COLLECTIONS_KEY, queryFn: fetchCollections })
    }
  }, [isAuthenticated, queryClient])

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              ALL Content
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  Content
                </span>
              </NavLink>
              <NavLink to="/collections" className={navLinkClass}>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  Collections
                </span>
              </NavLink>
              <NavLink to="/multilingual" className={navLinkClass}>
                <span className="flex items-center gap-1.5">
                  <Languages className="h-4 w-4" />
                  Multilingual
                </span>
              </NavLink>
              <NavLink to="/bulk-upload" className={navLinkClass}>
                <span className="flex items-center gap-1.5">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </span>
              </NavLink>
              {isAdmin && (
                <>
                  <NavLink to="/users" className={navLinkClass}>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      Users
                    </span>
                  </NavLink>
                  <NavLink to="/audit-logs" className={navLinkClass}>
                    <span className="flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4" />
                      Audit Logs
                    </span>
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.username}
              <span className="ml-1 text-xs">({user?.role})</span>
            </span>
            <Button variant="ghost" size="icon" title="Logout" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<ProtectedRoute><ContentListPage /></ProtectedRoute>} />
          <Route path="/content/new" element={<ProtectedRoute><CreateContentPage /></ProtectedRoute>} />
          <Route path="/content/:id/edit" element={<ProtectedRoute><EditContentPage /></ProtectedRoute>} />
          <Route path="/collections" element={<ProtectedRoute><CollectionListPage /></ProtectedRoute>} />
          <Route path="/collections/new" element={<ProtectedRoute><CreateCollectionPage /></ProtectedRoute>} />
          <Route path="/collections/:id/edit" element={<ProtectedRoute><EditCollectionPage /></ProtectedRoute>} />
          <Route path="/multilingual" element={<ProtectedRoute><MultilingualListPage /></ProtectedRoute>} />
          <Route path="/multilingual/new" element={<ProtectedRoute><CreateMultilingualPage /></ProtectedRoute>} />
          <Route path="/multilingual/:id/edit" element={<ProtectedRoute><EditMultilingualPage /></ProtectedRoute>} />
          <Route path="/bulk-upload" element={<ProtectedRoute><BulkUploadPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><AdminRoute><UserManagementPage /></AdminRoute></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><AdminRoute><AuditLogPage /></AdminRoute></ProtectedRoute>} />
          <Route path="/login" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
