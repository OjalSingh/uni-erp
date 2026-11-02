import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import Pager from '../components/Pager.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { errMsg } from '../format.ts'
import type { Paged, Schedule } from '../format.ts'

interface Mark {
  _id: string
  rollNo: string
  part: number
  theoryMarks: number
  practicalMarks: number
  totalMarks: number
  student: { enrollNo: string; name: string }
  course: { name: string }
}

export default function Marks() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [data, setData] = useState<Paged<Mark> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [add, setAdd] = useState({ enrollNo: '', part: '1', theoryMarks: '', practicalMarks: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ theoryMarks: '', practicalMarks: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api<Schedule[]>('/exams/schedules').then(setSchedules).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(() => {
    if (!schedule) return
    const q = new URLSearchParams({ schedule, search, page: String(page), limit: '10' })
    api<Paged<Mark>>(`/marks?${q}`).then(setData).catch((e) => setError(errMsg(e)))
  }, [schedule, search, page])
  useEffect(load, [load])

  const addMarks = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/marks', { method: 'POST', body: { schedule, ...add, part: Number(add.part), theoryMarks: Number(add.theoryMarks), practicalMarks: Number(add.practicalMarks) } })
      setAdd((a) => ({ ...a, enrollNo: '', theoryMarks: '', practicalMarks: '' }))
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const saveEdit = async (id: string) => {
    setError('')
    try {
      await api(`/marks/${id}`, { method: 'PUT', body: { theoryMarks: Number(edit.theoryMarks), practicalMarks: Number(edit.practicalMarks) } })
      setEditId(null)
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const remove = async (m: Mark) => {
    if (!window.confirm(`Delete marks for ${m.student.name}?`)) return
    try {
      await api(`/marks/${m._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <>
      <h1 className="page-title">Mark Information</h1>
      <section className="panel">
        <div className="toolbar">
          <ScheduleSelect schedules={schedules} value={schedule} onChange={(id) => { setSchedule(id); setPage(1) }} />
          <input placeholder="Search by name, enrollment or roll no." aria-label="Search marks" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <form className="toolbar" onSubmit={addMarks}>
          <input required placeholder="Student enrollment no." aria-label="Enrollment number" value={add.enrollNo} onChange={(e) => setAdd((a) => ({ ...a, enrollNo: e.target.value }))} />
          <label>
            Part <input type="number" min={1} max={6} style={{ width: 64 }} value={add.part} onChange={(e) => setAdd((a) => ({ ...a, part: e.target.value }))} />
          </label>
          <input required type="number" min={0} placeholder="Theory marks" aria-label="Theory marks" value={add.theoryMarks} onChange={(e) => setAdd((a) => ({ ...a, theoryMarks: e.target.value }))} />
          <input required type="number" min={0} placeholder="Practical marks" aria-label="Practical marks" value={add.practicalMarks} onChange={(e) => setAdd((a) => ({ ...a, practicalMarks: e.target.value }))} />
          <button className="btn-save" type="submit" disabled={!schedule}>
            Add marks
          </button>
        </form>
        {error && <p className="err pad">{error}</p>}
        <table className="grid">
          <thead>
            <tr>
              <th>Enroll No</th>
              <th>Roll No</th>
              <th>Name</th>
              <th>Part</th>
              <th>Theory</th>
              <th>Practical</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((m) => (
              <tr key={m._id}>
                <td>{m.student.enrollNo}</td>
                <td>{m.rollNo}</td>
                <td>{m.student.name}</td>
                <td>{m.part}</td>
                {editId === m._id ? (
                  <>
                    <td>
                      <input type="number" min={0} style={{ width: 80 }} aria-label="Theory marks" value={edit.theoryMarks} onChange={(e) => setEdit((x) => ({ ...x, theoryMarks: e.target.value }))} />
                    </td>
                    <td>
                      <input type="number" min={0} style={{ width: 80 }} aria-label="Practical marks" value={edit.practicalMarks} onChange={(e) => setEdit((x) => ({ ...x, practicalMarks: e.target.value }))} />
                    </td>
                    <td>{Number(edit.theoryMarks || 0) + Number(edit.practicalMarks || 0)}</td>
                    <td>
                      <button className="btn-mod" onClick={() => saveEdit(m._id)}>
                        Save
                      </button>{' '}
                      <button className="btn-del" onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{m.theoryMarks}</td>
                    <td>{m.practicalMarks}</td>
                    <td>{m.totalMarks}</td>
                    <td>
                      <button className="btn-mod" onClick={() => { setEditId(m._id); setEdit({ theoryMarks: String(m.theoryMarks), practicalMarks: String(m.practicalMarks) }) }}>
                        Modify
                      </button>{' '}
                      <button className="btn-del" onClick={() => remove(m)}>
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="empty-note">No marks entered for this schedule yet.</p>}
        <Pager page={data?.page ?? 1} pages={data?.pages ?? 1} total={data?.total ?? 0} onPage={setPage} />
      </section>
    </>
  )
}
