import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  changePassword,
  type CmsUser,
  type CreateUserPayload,
} from '@/api/users'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'

type ModalMode = 'create' | 'edit' | 'password' | null

export function UserManagementPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedUser, setSelectedUser] = useState<CmsUser | null>(null)

  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'curator'>('curator')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User created successfully' })
      closeModal()
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create user',
        description: err?.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ virtualId, payload }: { virtualId: number; payload: any }) =>
      updateUser(virtualId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User updated successfully' })
      closeModal()
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to update user',
        description: err?.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User deactivated' })
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to deactivate user',
        description: err?.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: ({ virtualId, newPassword }: { virtualId: number; newPassword: string }) =>
      changePassword(virtualId, newPassword),
    onSuccess: () => {
      toast({ title: 'Password changed successfully' })
      closeModal()
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to change password',
        description: err?.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  function openCreate() {
    setModalMode('create')
    setSelectedUser(null)
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setEmail('')
    setRole('curator')
  }

  function openEdit(user: CmsUser) {
    setModalMode('edit')
    setSelectedUser(user)
    setUsername(user.username)
    setEmail(user.email || '')
    setRole(user.role)
  }

  function openPassword(user: CmsUser) {
    setModalMode('password')
    setSelectedUser(user)
    setPassword('')
    setConfirmPassword('')
  }

  function closeModal() {
    setModalMode(null)
    setSelectedUser(null)
  }

  function handleSubmit() {
    if (modalMode === 'create') {
      if (!username.trim() || !password.trim()) {
        toast({ title: 'Username and password are required', variant: 'destructive' })
        return
      }
      if (password !== confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' })
        return
      }
      if (password.length < 6) {
        toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
        return
      }
      createMutation.mutate({ username: username.trim(), password, email: email.trim() || undefined, role })
    } else if (modalMode === 'edit' && selectedUser) {
      updateMutation.mutate({
        virtualId: selectedUser.virtualId,
        payload: { username: username.trim(), email: email.trim() || undefined, role },
      })
    } else if (modalMode === 'password' && selectedUser) {
      if (password.length < 6) {
        toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
        return
      }
      if (password !== confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' })
        return
      }
      passwordMutation.mutate({ virtualId: selectedUser.virtualId, newPassword: password })
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending || passwordMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button onClick={openCreate}>Create User</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Virtual ID</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !users.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.virtualId}>
                  <TableCell className="font-mono text-xs">{u.virtualId}</TableCell>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary'
                      }`}
                    >
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openPassword(u)}>
                        Password
                      </Button>
                      {u.isActive && u.virtualId !== currentUser?.virtualId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deactivateMutation.mutate(u.virtualId)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit / Password Modal */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' && 'Create User'}
              {modalMode === 'edit' && 'Edit User'}
              {modalMode === 'password' && 'Change Password'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {modalMode !== 'password' && (
              <>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'curator')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curator">Curator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {(modalMode === 'create' || modalMode === 'password') && (
              <>
                <div className="space-y-2">
                  <Label>{modalMode === 'password' ? 'New Password' : 'Password'}</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={modalMode === 'password' ? 'Enter new password' : 'Enter password'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
