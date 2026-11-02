import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import Pager from '../components/Pager.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { errMsg, fmtDate } from '../format.ts'
import type { Paged, Schedule } from '../format.ts'

interface ExamForm {
  _id: string
  rollNo: string
  part: number
  medium: string
  status: 'Pending' | 'Accepted' | 'Denied'
  filledAt: string
  student: { enrollNo: string; name: string }
  center: { code: string }
  course: { name: string; code?: string }
}

export default function ExamForms() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [data, setData] = useState<Paged<ExamForm> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [add, setAdd] = useState({ enrollNo: '', part: '1', medium: 'Hindi' })
  const [newSched, setNewSched] = useState({ examTerm: 'May-June', year: String(new Date().getFullYear()), formStart: '', formEnd: '' })
  const [showSched, setShowSched] = useState(false)
  const [error, setError] = useState('')

  const loadSchedules = useCallback(() => {
    api<Schedule[]>('/exams/schedules').then(setSchedules).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(loadSchedules, [loadSchedules])

  const load = useCallback(() => {
    if (!schedule) return
    const q = new URLSearchParams({ schedule, search, page: String(page), limit: '10' })
    api<Paged<ExamForm>>(`/exams/forms?${q}`).then((d) => { setData(d); setSelected([]) }).catch((e) => setError(errMsg(e)))
  }, [schedule, search, page])
  useEffect(load, [load])

  const addForm = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/exams/forms', { method: 'POST', body: { schedule, ...add, part: Number(add.part) } })
      setAdd((a) => ({ ...a, enrollNo: '' }))
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const createSchedule = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/exams/schedules', { method: 'POST', body: { ...newSched, year: Number(newSched.year) } })
      setShowSched(false)
      loadSchedules()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const setStatus = async (ids: string[], status: string) => {
    if (ids.length === 0) return setError('Select at least one form first')
    setError('')
    try {
      await api('/exams/forms/status', { method: 'POST', body: { ids, status } })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const remove = async (f: ExamForm) => {
    if (!window.confirm(`Remove the exam form for ${f.student.name}?`)) return
    try {
      await api(`/exams/forms/${f._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const current = schedules.find((s) => s._id === schedule)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Fill Exam Form</h1>
        {isAdmin && (
          <button className="btn-create" onClick={() => setShowSched((v) => !v)}>
            {showSched ? 'Close' : 'New exam schedule'}
          </button>
        )}
      </div>

      {showSched && (
        <section className="panel">
          <form className="toolbar" onSubmit={createSchedule}>
            <label>
              Term{' '}
              <select value={newSched.examTerm} onChange={(e) => setNewSched((s) => ({ ...s, examTerm: e.target.value }))}>
                <option>May-June</option>
                <option>Nov-Dec</option>
              </select>
            </label>
            <label>
              Year <input type="number" required style={{ width: 90 }} value={newSched.year} onChange={(e) => setNewSched((s) => ({ ...s, year: e.target.value }))} />
            </label>
            <label>
              Forms open <input type="date" required value={newSched.formStart} onChange={(e) => setNewSched((s) => ({ ...s, formStart: e.target.value }))} />
            </label>
            <label>
              Forms close <input type="date" required value={newSched.formEnd} onChange={(e) => setNewSched((s) => ({ ...s, formEnd: e.target.value }))} />
            </label>
            <button className="btn-save" type="submit">
              Create schedule
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <ScheduleSelect schedules={schedules} value={schedule} onChange={(id) => { setSchedule(id); setPage(1) }} />
          {current && (
            <span className="hint">
              Forms open {fmtDate(current.formStart)} to {fmtDate(current.formEnd)}
            </span>
          )}
        </div>
        <form className="toolbar" onSubmit={addForm}>
          <input required placeholder="Student enrollment no." aria-label="Enrollment number" value={add.enrollNo} onChange={(e) => setAdd((a) => ({ ...a, enrollNo: e.target.value }))} />
          <label>
            Part <input type="number" min={1} max={6} style={{ width: 64 }} value={add.part} onChange={(e) => setAdd((a) => ({ ...a, part: e.target.value }))} />
          </label>
          <label>
            Medium{' '}
            <select value={add.medium} onChange={(e) => setAdd((a) => ({ ...a, medium: e.target.value }))}>
              <option>Hindi</option>
              <option>English</option>
            </select>
          </label>
          <button className="btn-save" type="submit" disabled={!schedule}>
            Add exam form
          </button>
        </form>
        {error && <p className="err pad">{error}</p>}
        <div className="toolbar">
          <input placeholder="Search by name, enrollment or roll no." aria-label="Search exam forms" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          {isAdmin && (
            <span>
              <button className="btn-quiet" onClick={() => setStatus(selected, 'Accepted')}>
                Accept selected
              </button>{' '}
              <button className="btn-quiet" onClick={() => setStatus(selected, 'Denied')}>
                Deny selected
              </button>
            </span>
          )}
        </div>
        <table className="grid">
          <thead>
            <tr>
              {isAdmin && <th aria-label="Select" />}
              <th>Enroll No</th>
              <th>Name</th>
              <th>Center</th>
              <th>Roll No</th>
              <th>Part</th>
              <th>Medium</th>
              <th>Filled on</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((f) => (
              <tr key={f._id}>
                {isAdmin && (
                  <td>
                    <input type="checkbox" aria-label={`Select ${f.student.name}`} checked={selected.includes(f._id)} onChange={() => toggle(f._id)} />
                  </td>
                )}
                <td>{f.student.enrollNo}</td>
                <td>{f.student.name}</td>
                <td>{f.center?.code}</td>
                <td>{f.rollNo}</td>
                <td>{f.part}</td>
                <td>{f.medium}</td>
                <td>{fmtDate(f.filledAt)}</td>
                <td>
                  <span className={`status ${f.status === 'Accepted' ? 'on' : 'off'}`}>{f.status}</span>
                </td>
                <td>
                  <button className="btn-del" onClick={() => remove(f)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="empty-note">No exam forms for this schedule yet.</p>}
        <Pager page={data?.page ?? 1} pages={data?.pages ?? 1} total={data?.total ?? 0} onPage={setPage} />
      </section>
    </>
  )
}
