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
import Employees from './pages/Employees.tsx'
import ExamForms from './pages/ExamForms.tsx'
import Marks from './pages/Marks.tsx'
import Results from './pages/Results.tsx'
import Misc from './pages/Misc.tsx'
import Books from './pages/Books.tsx'
import BookNew from './pages/BookNew.tsx'
import BookDetail from './pages/BookDetail.tsx'
import Stock from './pages/Stock.tsx'
import AdmitCards from './pages/AdmitCards.tsx'
import IdCards from './pages/IdCards.tsx'
import Certificates from './pages/Certificates.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import { MODULES } from './modules.ts'

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

const built: Record<string, ReactNode> = {
  students: <Students />,
  centers: <Centers />,
  employees: <Employees />,
  'exam-form': <ExamForms />,
  marks: <Marks />,
  results: <Results />,
  'admit-cards': <AdmitCards />,
  'id-cards': <IdCards />,
  certificates: <Certificates />,
  'change-password': <ChangePassword />,
  books: <Books />,
  stock: <Stock />,
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
        {MODULES.map((m) => {
          const page = built[m.path] ?? <Placeholder title={m.label} />
          return <Route key={m.path} path={m.path} element={m.adminOnly ? <AdminOnly>{page}</AdminOnly> : page} />
        })}
        <Route path="books/new" element={<AdminOnly><BookNew /></AdminOnly>} />
        <Route path="books/:id" element={<BookDetail />} />
        <Route path="stock/:view" element={<AdminOnly><Stock /></AdminOnly>} />
        <Route path="students/new" element={<StudentForm />} />
        <Route path="students/:id/edit" element={<StudentForm />} />
        <Route path="misc/:name" element={<Misc />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
