import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import { errMsg, fmtDate, scheduleLabel } from '../format.ts'
import type { Schedule } from '../format.ts'

interface ResultRow {
  _id: string
  publishId: number
  schedule: Schedule
  comments?: string
  publishDate: string
  endDate: string
  published: boolean
  formsFilled: number
  marksAdded: number
  publishedCount: number
  unpublishedCount: number
}

const blank = { schedule: '', comments: '', publishDate: '', endDate: '' }

export default function Results() {
  const [rows, setRows] = useState<ResultRow[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<ResultRow[]>('/results').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(() => {
    load()
    api<Schedule[]>('/exams/schedules').then(setSchedules).catch(() => undefined)
  }, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/results', { method: 'POST', body: form })
      setForm(blank)
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const toggle = async (r: ResultRow) => {
    setError('')
    try {
      await api(`/results/${r._id}/${r.published ? 'unpublish' : 'publish'}`, { method: 'POST' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <>
      <h1 className="page-title">Publish Result</h1>
      <section className="panel">
        <form className="toolbar" onSubmit={submit}>
          <select required value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} aria-label="Exam schedule">
            <option value="">Select exam schedule</option>
            {schedules.map((s) => (
              <option key={s._id} value={s._id}>
                {scheduleLabel(s)}
              </option>
            ))}
          </select>
          <input placeholder="About this result" aria-label="About this result" value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} />
          <label>
            Publish date <input type="date" required value={form.publishDate} onChange={(e) => setForm((f) => ({ ...f, publishDate: e.target.value }))} />
          </label>
          <label>
            End date <input type="date" required value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </label>
          <button className="btn-save" type="submit">
            Save
          </button>
        </form>
        {error && <p className="err pad">{error}</p>}
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Exam</th>
              <th>About</th>
              <th>Publish date</th>
              <th>End date</th>
              <th>Forms accepted</th>
              <th>Marks added</th>
              <th>Published</th>
              <th>Unpublished</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.publishId}</td>
                <td>{scheduleLabel(r.schedule)}</td>
                <td>{r.comments}</td>
                <td>{fmtDate(r.publishDate)}</td>
                <td>{fmtDate(r.endDate)}</td>
                <td>{r.formsFilled}</td>
                <td>{r.marksAdded}</td>
                <td>{r.publishedCount}</td>
                <td>{r.unpublishedCount}</td>
                <td>
                  <span className={`status ${r.published ? 'on' : 'off'}`}>{r.published ? 'Published' : 'Not published'}</span>
                </td>
                <td>
                  <button className="btn-mod" onClick={() => toggle(r)}>
                    {r.published ? 'Unpublish' : 'Publish'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty-note">No results scheduled yet.</p>}
      </section>
    </>
  )
}
