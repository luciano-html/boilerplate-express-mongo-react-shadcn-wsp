import { createContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '@/types'
import api from '@/services/api'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data?.user || res.data?.data?.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { email: username, password })
    setUser(data.data?.user || data.user)
  }, [])

  const logout = useCallback(async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
    await api.post('/auth/logout')
    setUser(null)
    window.location.href = '/login'
  }, [queryClient])

  const value = useMemo(
    () => ({ user, login, logout, loading }),
    [user, login, logout, loading]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
