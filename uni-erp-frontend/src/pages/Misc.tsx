import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.ts'
import { errMsg } from '../format.ts'

interface CourseType {
  _id: string
  name: string
}
interface Course {
  _id: string
  name: string
  code?: string
  parts: number
  courseType: CourseType
}
interface Subject {
  _id: string
  name: string
  code?: string
  part: number
}

function Notice({ error }: { error: string }) {
  return error ? <p className="err pad">{error}</p> : null
}

function CourseTypes() {
  const [rows, setRows] = useState<CourseType[]>([])
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<CourseType[]>('/masters/course-types').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editId) await api(`/masters/course-types/${editId}`, { method: 'PUT', body: { name } })
      else await api('/masters/course-types', { method: 'POST', body: { name } })
      setName('')
      setEditId(null)
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <section className="panel">
      <form className="toolbar" onSubmit={submit}>
        <input required placeholder="Course type name" aria-label="Course type name" value={name} onChange={(e) => setName(e.target.value)} />
        <span>
          <button className="btn-save" type="submit">
            {editId ? 'Save name' : 'Add course type'}
          </button>{' '}
          {editId && (
            <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setName('') }}>
              Cancel
            </button>
          )}
        </span>
      </form>
      <Notice error={error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Course type</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.name}</td>
              <td>
                <button className="btn-mod" onClick={() => { setEditId(r._id); setName(r.name) }}>
                  Rename
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-note">No course types yet. Add one above.</p>}
    </section>
  )
}

const blankCourse = { courseType: '', name: '', code: '', parts: '1' }

function Courses() {
  const [rows, setRows] = useState<Course[]>([])
  const [types, setTypes] = useState<CourseType[]>([])
  const [form, setForm] = useState(blankCourse)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<Course[]>('/masters/courses').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(() => {
    load()
    api<CourseType[]>('/masters/course-types').then(setTypes).catch(() => undefined)
  }, [load])

  const set = (k: keyof typeof blankCourse, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const body = { ...form, parts: Number(form.parts) }
      if (editId) await api(`/masters/courses/${editId}`, { method: 'PUT', body })
      else await api('/masters/courses', { method: 'POST', body })
      setForm(blankCourse)
      setEditId(null)
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <section className="panel">
      <form className="toolbar" onSubmit={submit}>
        <select required value={form.courseType} onChange={(e) => set('courseType', e.target.value)} aria-label="Course type">
          <option value="">Course type</option>
          {types.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>
        <input required placeholder="Course name" aria-label="Course name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <input placeholder="Code (1-2 digits)" aria-label="Course code" maxLength={2} value={form.code} onChange={(e) => set('code', e.target.value.replace(/\D/g, ''))} />
        <label>
          Parts{' '}
          <input type="number" min={1} max={6} style={{ width: 64 }} value={form.parts} onChange={(e) => set('parts', e.target.value)} />
        </label>
        <span>
          <button className="btn-save" type="submit">
            {editId ? 'Save course' : 'Add course'}
          </button>{' '}
          {editId && (
            <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm(blankCourse) }}>
              Cancel
            </button>
          )}
        </span>
      </form>
      <Notice error={error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Course type</th>
            <th>Course name</th>
            <th>Code</th>
            <th>Parts</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.courseType?.name}</td>
              <td>{r.name}</td>
              <td>{r.code}</td>
              <td>{r.parts}</td>
              <td>
                <button
                  className="btn-mod"
                  onClick={() => { setEditId(r._id); setForm({ courseType: r.courseType?._id ?? '', name: r.name, code: r.code ?? '', parts: String(r.parts) }) }}
                >
                  Modify
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-note">No courses yet. Add a course type first, then a course.</p>}
    </section>
  )
}

function Subjects() {
  const [courses, setCourses] = useState<Course[]>([])
  const [course, setCourse] = useState('')
  const [part, setPart] = useState(1)
  const [rows, setRows] = useState<Subject[]>([])
  const [form, setForm] = useState({ name: '', code: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Course[]>('/masters/courses').then((c) => {
      setCourses(c)
      if (c[0]) setCourse(c[0]._id)
    }).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(() => {
    if (!course) return setRows([])
    api<Subject[]>(`/masters/subjects?course=${course}&part=${part}`).then(setRows).catch((e) => setError(errMsg(e)))
  }, [course, part])
  useEffect(load, [load])

  const parts = courses.find((c) => c._id === course)?.parts ?? 1

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editId) await api(`/masters/subjects/${editId}`, { method: 'PUT', body: { ...form, part } })
      else await api('/masters/subjects', { method: 'POST', body: { ...form, course, part } })
      setForm({ name: '', code: '' })
      setEditId(null)
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <label>
          Course{' '}
          <select value={course} onChange={(e) => { setCourse(e.target.value); setPart(1) }}>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Part{' '}
          <select value={part} onChange={(e) => setPart(Number(e.target.value))}>
            {Array.from({ length: parts }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="toolbar" onSubmit={submit}>
        <input required placeholder="Subject name" aria-label="Subject name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input placeholder="Subject code" aria-label="Subject code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <span>
          <button className="btn-save" type="submit" disabled={!course}>
            {editId ? 'Save subject' : 'Add subject'}
          </button>{' '}
          {editId && (
            <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm({ name: '', code: '' }) }}>
              Cancel
            </button>
          )}
        </span>
      </form>
      <Notice error={error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Code</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.name}</td>
              <td>{r.code}</td>
              <td>
                <button className="btn-mod" onClick={() => { setEditId(r._id); setForm({ name: r.name, code: r.code ?? '' }) }}>
                  Modify
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-note">No subjects for this course and part yet.</p>}
    </section>
  )
}

export default function Misc() {
  const { name = '' } = useParams()
  return (
    <>
      <h1 className="page-title">{name}</h1>
      {name === 'Course Type' && <CourseTypes />}
      {name === 'Course Details' && <Courses />}
      {name === 'Subject Details' && <Subjects />}
      {!['Course Type', 'Course Details', 'Subject Details'].includes(name) && (
        <section className="panel empty">
          <p>This screen has not been built yet.</p>
        </section>
      )}
    </>
  )
}

