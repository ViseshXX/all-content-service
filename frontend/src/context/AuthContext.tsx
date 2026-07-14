import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, getMe } from '@/api/auth'
import { toast } from '@/hooks/use-toast'

interface AuthUser {
  virtualId: number
  username: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, check if we have a stored token and validate it
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
      // Validate token with backend
      getMe()
        .then((me) => {
          const userData = { virtualId: me.virtualId, username: me.username, role: me.role }
          setUser(userData)
          localStorage.setItem('auth_user', JSON.stringify(userData))
        })
        .catch(() => {
          // Token is invalid — clear state
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          setUser(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    const { token, user: userData } = res.data
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // Ignore logout API errors — clear local state regardless
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
    toast({ title: 'Logged out successfully' })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
