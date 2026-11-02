import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { SESSIONS } from '../constants.ts'

interface Student {
  _id: string
  enrollNo: string
  session: string
  name: string
  mobile: string
  image?: string
  status: string
  center?: { code: string; name: string }
  course?: { name: string }
}

interface Page {
  items: Student[]
  total: number
  page: number
  pages: number
}

export default function Students() {
  const [session, setSession] = useState(SESSIONS[1])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const q = new URLSearchParams({ session, search, page: String(page), limit: '10' })
    api<Page>(`/students?${q}`).then(setData).catch((e: Error) => setError(e.message))
  }, [session, search, page])

  useEffect(load, [load])

  const deactivate = async (s: Student) => {
    if (!window.confirm(`Deactivate ${s.name}?`)) return
    try {
      await api(`/students/${s._id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Student Registration</h1>
        <Link to="/students/new" className="btn-create">
          New registration
        </Link>
      </div>
      <section className="panel">
      <div className="toolbar">
        <label>
          Session{' '}
          <select
            value={session}
            onChange={(e) => {
              setSession(e.target.value)
              setPage(1)
            }}
          >
            {SESSIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <input
          placeholder="Search by name, enrollment or mobile" aria-label="Search students"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>
      {error && <p className="err pad">{error}</p>}
      <table className="grid">
        <thead>
          <tr>
            <th>Enroll No</th>
            <th>Center code</th>
            <th>Session</th>
            <th>Name</th>
            <th>Image</th>
            <th>Mobile No</th>
            <th>Course</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((s) => (
            <tr key={s._id}>
              <td>{s.enrollNo}</td>
              <td>{s.center?.code}</td>
              <td>{s.session}</td>
              <td>{s.name}</td>
              <td>{s.image ? <img className="thumb" src={s.image} alt="" /> : null}</td>
              <td>{s.mobile}</td>
              <td>{s.course?.name}</td>
              <td><span className={`status ${s.status === 'Active' ? 'on' : 'off'}`}>{s.status}</span></td>
              <td>
                <Link to={`/students/${s._id}/edit`} className="btn-mod">
                  Modify
                </Link>{' '}
                <button className="btn-del" onClick={() => deactivate(s)}>
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.items.length === 0 && <p className="empty-note">No students found for this session.</p>}
      <div className="pager">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {data?.page ?? 1} of {data?.pages || 1} ({data?.total ?? 0} students)
        </span>
        <button disabled={!data || page >= data.pages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
    </>
  )
}
