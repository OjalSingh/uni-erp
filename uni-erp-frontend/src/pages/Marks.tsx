import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import Pager from '../components/Pager.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { errMsg } from '../format.ts'
import type { Paged, Schedule } from '../format.ts'
import { block, divisionText, pct } from '../result.ts'
import type { PartOne, ResultSummary } from '../result.ts'

interface Mark {
  _id: string
  rollNo?: string
  part: number
  student: { enrollNo: string; name: string }
  result: ResultSummary
}

interface EntrySubject {
  id: string
  code?: string
  name: string
  type: 'Theory' | 'Practical'
  maxMarks: number
}
interface Entry {
  markId: string | null
  student: { name: string; fatherName?: string; enrollNo: string; session?: string; centerCode?: string }
  rollNo: string
  part: number
  course: { name: string; parts: number }
  subjects: EntrySubject[]
  values: Record<string, number>
  partOne: PartOne | null
}

export default function Marks() {
  const { can } = useAuth()
  const canEdit = can('marks:edit')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [entry, setEntry] = useState<Entry | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [data, setData] = useState<Paged<Mark> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<Schedule[]>('/exams/schedules').then(setSchedules).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(() => {
    if (!schedule) return
    const q = new URLSearchParams({ schedule, search, page: String(page), limit: '10' })
    api<Paged<Mark>>(`/marks?${q}`).then(setData).catch((e) => setError(errMsg(e)))
  }, [schedule, search, page])
  useEffect(load, [load])

  const open = async (roll: string) => {
    setError('')
    setNotice('')
    setEntry(null)
    try {
      const e = await api<Entry>(`/marks/entry?${new URLSearchParams({ schedule, rollNo: roll.trim() })}`)
      setEntry(e)
      setRollNo(e.rollNo)
      setValues(Object.fromEntries(e.subjects.map((s) => [s.id, e.values[s.id] === undefined ? '' : String(e.values[s.id])])))
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const find = (ev: FormEvent) => {
    ev.preventDefault()
    open(rollNo)
  }

  // Running totals and divisions while typing (the server recalculates on save)
  const live = useMemo(() => {
    if (!entry) return null
    const rows = (type: string) => entry.subjects.filter((s) => s.type === type).map((s) => ({ maxMarks: s.maxMarks, marks: Number(values[s.id]) || 0 }))
    const t = block(rows('Theory'))
    const p = block(rows('Practical'))
    return { theory: t, practical: p, total: block([...rows('Theory'), ...rows('Practical')]) }
  }, [entry, values])

  const save = async () => {
    if (!entry) return
    setError('')
    setBusy(true)
    try {
      await api('/marks/entry', { method: 'POST', body: { schedule, rollNo: entry.rollNo, marks: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? '' : Number(v)])) } })
      setNotice(`Marks saved for roll number ${entry.rollNo}.`)
      setEntry(null)
      setRollNo('')
      load()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: Mark) => {
    if (!window.confirm(`Delete the marks for ${m.student.name}?`)) return
    try {
      await api(`/marks/${m._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const section = (type: 'Theory' | 'Practical') => {
    const rows = entry!.subjects.filter((s) => s.type === type)
    if (!rows.length) return null
    return (
      <>
        <tr className="grid-section">
          <td colSpan={4}>{type}</td>
        </tr>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>{s.code}</td>
            <td>{s.name}</td>
            <td>{s.maxMarks}</td>
            <td>
              <input type="number" min={0} max={s.maxMarks} step={1} style={{ width: 90 }} aria-label={`${s.name} marks obtained`} value={values[s.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))} disabled={!canEdit} />
            </td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <>
      <h1 className="page-title">Mark Information</h1>
      <section className="panel">
        <form className="toolbar" onSubmit={find}>
          <ScheduleSelect schedules={schedules} value={schedule} onChange={(id) => { setSchedule(id); setPage(1); setEntry(null) }} />
          {canEdit && (
            <>
              <input placeholder="Roll number" aria-label="Roll number" inputMode="numeric" value={rollNo} onChange={(e) => setRollNo(e.target.value.replace(/\D/g, ''))} />
              <button className="btn-save" type="submit" disabled={!schedule || !rollNo}>
                Find student
              </button>
            </>
          )}
        </form>
        {error && <p className="err pad" role="alert">{error}</p>}
        {notice && <p className="ok pad" role="status">{notice}</p>}
      </section>

      {entry && live && (
        <section className="panel">
          <div className="entry-head">
            <dl>
              <dt>Enrollment No</dt><dd>{entry.student.enrollNo}</dd>
              <dt>Roll No</dt><dd>{entry.rollNo}</dd>
              <dt>Session</dt><dd>{entry.student.session}</dd>
              <dt>Center code</dt><dd>{entry.student.centerCode}</dd>
              <dt>Student</dt><dd>{entry.student.name}</dd>
              <dt>Father's name</dt><dd>{entry.student.fatherName}</dd>
              <dt>Course</dt><dd>{entry.course.name}</dd>
              <dt>Part</dt><dd>{entry.course.parts > 1 ? `${entry.part} of ${entry.course.parts}` : 'Single part'}</dd>
            </dl>
            {entry.partOne && (
              <p className="part-one">
                Part 1: {entry.partOne.obtained} of {entry.partOne.total} marks
              </p>
            )}
            {entry.markId && <p className="hint">Marks were already entered for this student. Saving replaces them.</p>}
          </div>

          {entry.subjects.length === 0 ? (
            <p className="empty-note">
              No subjects are set up for this course and part yet. Add them under <Link to="/misc/Subject%20Details">Miscellaneous &gt; Subject Details</Link>.
            </p>
          ) : (
            <>
              <table className="grid marks-grid">
                <thead>
                  <tr>
                    <th>Paper</th>
                    <th>Subject</th>
                    <th>Total marks</th>
                    <th>Marks obtained</th>
                  </tr>
                </thead>
                <tbody>
                  {section('Theory')}
                  {section('Practical')}
                </tbody>
              </table>
              <dl className="live-totals" aria-live="polite">
                <dt>Theory</dt><dd>{live.theory.obtained} / {live.theory.max} ({pct(live.theory.percent)}) {live.theory.division && divisionText(live.theory.division)}</dd>
                <dt>Practical</dt><dd>{live.practical.obtained} / {live.practical.max} ({pct(live.practical.percent)}) {live.practical.division && divisionText(live.practical.division)}</dd>
                <dt>Total</dt><dd><b>{live.total.obtained} / {live.total.max}</b> ({pct(live.total.percent)}) {live.total.division && divisionText(live.total.division)}</dd>
              </dl>
              {canEdit && (
                <div className="actions">
                  <button className="btn-save" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save marks'}</button>{' '}
                  <button className="btn-quiet" onClick={() => setEntry(null)}>Cancel</button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search by name, enrollment or roll no." aria-label="Search marks" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
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
              <th>Result</th>
              {canEdit && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((m) => (
              <tr key={m._id}>
                <td>{m.student.enrollNo}</td>
                <td>{m.rollNo}</td>
                <td>{m.student.name}</td>
                <td>{m.part}</td>
                <td>{m.result.theory.obtained}/{m.result.theory.max}</td>
                <td>{m.result.practical.obtained}/{m.result.practical.max}</td>
                <td>{m.result.total.obtained}/{m.result.total.max}</td>
                <td>
                  {m.result.incomplete ? <span className="status off">Incomplete ({m.result.missingPapers} paper{m.result.missingPapers === 1 ? '' : 's'} missing)</span> : <span className={`status ${m.result.qualified ? 'on' : 'off'}`}>{m.result.qualified ? divisionText(m.result.total.division) : 'Not qualified'}</span>}
                </td>
                {canEdit && (
                  <td>
                    <button className="btn-mod" onClick={() => m.rollNo && open(m.rollNo)}>Modify</button>{' '}
                    <button className="btn-del" onClick={() => remove(m)}>Delete</button>
                  </td>
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
