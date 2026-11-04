import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth.tsx'
import Layout from './components/Layout.tsx'
import Can from './components/Can.tsx'
import Login from './pages/Login.tsx'
import Landing from './pages/Landing.tsx'
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
import Result from './pages/Result.tsx'
import AdmitCards from './pages/AdmitCards.tsx'
import IdCards from './pages/IdCards.tsx'
import Certificates from './pages/Certificates.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import { MODULES } from './modules.ts'

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

function Home() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>
  if (user) return <Layout />
  return pathname === '/' ? <Landing /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/result" element={<Result />} />
      <Route
        path="/"
        element={<Home />}
      >
        <Route index element={<Dashboard />} />
        {MODULES.map((m) => {
          const page = built[m.path] ?? <Placeholder title={m.label} />
          return <Route key={m.path} path={m.path} element={m.perm ? <Can perm={m.perm}>{page}</Can> : page} />
        })}
        <Route path="books/new" element={<Can perm="invoices:manage"><BookNew /></Can>} />
        <Route path="books/:id" element={<Can perm="invoices:view"><BookDetail /></Can>} />
        <Route path="stock/:view" element={<Can perm="stock:view"><Stock /></Can>} />
        <Route path="students/new" element={<Can perm="students:create"><StudentForm /></Can>} />
        <Route path="students/:id/edit" element={<Can perm="students:edit"><StudentForm /></Can>} />
        <Route path="misc/:name" element={<Can perm="settings:manage"><Misc /></Can>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
