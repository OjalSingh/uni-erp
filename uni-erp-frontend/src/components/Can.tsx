import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth.tsx'

// Shows its children only to someone holding at least one of the permissions; others go back to the dashboard.
// This only keeps people off screens they cannot use. The server is what actually enforces permissions.
export default function Can({ perm, children }: { perm: string | string[]; children: ReactNode }) {
  const { can } = useAuth()
  return can(...(Array.isArray(perm) ? perm : [perm])) ? <>{children}</> : <Navigate to="/" replace />
}
