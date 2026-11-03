import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from './api.ts'

export interface User {
  _id: string
  username: string
  name: string
  role: 'admin' | 'center' // 'admin' sees every center, 'center' only its own
  center?: string
  permissions: string[]
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  can: (...permissions: string[]) => boolean // true if the user holds at least one
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  // Restore session on page load
  useEffect(() => {
    if (!getToken()) return
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { username, password } })
    setToken(r.token)
    setUser(r.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const can = (...permissions: string[]) => Boolean(user) && permissions.some((p) => user!.permissions?.includes(p))

  return <AuthContext.Provider value={{ user, loading, login, logout, can }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
