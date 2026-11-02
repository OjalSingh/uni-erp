import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth.tsx'
import Layout from './components/Layout.tsx'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Students from './pages/Students.tsx'
import Centers from './pages/Centers.tsx'
import StudentForm from './pages/StudentForm.tsx'
import Placeholder from './pages/Placeholder.tsx'
import { MODULES } from './modules.ts'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

const built: Record<string, ReactNode> = {
  students: <Students />,
  centers: <Centers />,
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        {MODULES.map((m) => (
          <Route key={m.path} path={m.path} element={built[m.path] ?? <Placeholder title={m.label} />} />
        ))}
        <Route path="students/new" element={<StudentForm />} />
        <Route path="students/:id/edit" element={<StudentForm />} />
        <Route path="misc/:name" element={<Placeholder title="Miscellaneous" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
