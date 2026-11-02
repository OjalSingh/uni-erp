import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.ts'
import MasterTable from '../components/MasterTable.tsx'
import { CENTER_MENUS } from '../constants.ts'
import { errMsg, fmtDate } from '../format.ts'
import { GROUPS, MISC } from '../modules.ts'

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


const on = (v: boolean) => <span className={`status ${v ? 'on' : 'off'}`}>{v ? 'Active' : 'Off'}</span>

interface StateRow { _id: string; name: string; active: boolean }
interface CityRow { _id: string; name: string; active: boolean; state: { _id: string; name: string } }
interface YearRow { _id: string; label: string; startDate?: string; endDate?: string; current: boolean }
interface MenuRow { _id: string; key: string; label: string; group: string; order: number; active: boolean; system: boolean }
interface SubMenuRow { _id: string; label: string; order: number; active: boolean; system: boolean; menu: { _id: string; label: string } }
interface RoleRow { _id: string; key: string; name: string; baseRole: 'admin' | 'center'; menus: string[]; active: boolean; system: boolean }
interface Screen { key: string; label: string }

function States() {
  return (
    <MasterTable<StateRow>
      endpoint="/config/states" noun="state" initial={{ active: true }}
      fields={[{ key: 'name', label: 'State', required: true }, { key: 'active', label: 'Active', type: 'checkbox' }]}
      columns={[{ label: 'State', render: (r) => r.name }, { label: 'Status', render: (r) => on(r.active) }]}
    />
  )
}

function Cities() {
  const [states, setStates] = useState<StateRow[]>([])
  useEffect(() => { api<StateRow[]>('/config/states').then(setStates).catch(() => undefined) }, [])
  return (
    <MasterTable<CityRow>
      endpoint="/config/cities" noun="city" initial={{ active: true }}
      fields={[
        { key: 'state', label: 'State', type: 'select', required: true, lockOnEdit: true, options: states.map((s) => ({ value: s._id, label: s.name })) },
        { key: 'name', label: 'City', required: true },
        { key: 'active', label: 'Active', type: 'checkbox' },
      ]}
      columns={[{ label: 'State', render: (r) => r.state?.name }, { label: 'City', render: (r) => r.name }, { label: 'Status', render: (r) => on(r.active) }]}
    />
  )
}

function FinancialYears() {
  return (
    <MasterTable<YearRow>
      endpoint="/config/financial-years" noun="financial year"
      note="These are the sessions offered on student registration, ID cards and the student list. Mark one as current to make it the default."
      fields={[
        { key: 'label', label: 'Year', required: true, lockOnEdit: true, placeholder: '2026-27' },
        { key: 'startDate', label: 'Starts', type: 'date' },
        { key: 'endDate', label: 'Ends', type: 'date' },
        { key: 'current', label: 'Current', type: 'checkbox' },
      ]}
      columns={[
        { label: 'Year', render: (r) => r.label },
        { label: 'Starts', render: (r) => fmtDate(r.startDate) },
        { label: 'Ends', render: (r) => fmtDate(r.endDate) },
        { label: 'Current', render: (r) => (r.current ? 'Yes' : '') },
      ]}
    />
  )
}

function Menus() {
  const [screens, setScreens] = useState<Screen[]>([])
  useEffect(() => { api<Screen[]>('/config/screens').then(setScreens).catch(() => undefined) }, [])
  return (
    <MasterTable<MenuRow>
      endpoint="/config/menus" noun="menu"
      note="Controls the sidebar and dashboard: name, group, order and whether a menu is shown. Roles decide who sees each menu."
      initial={{ active: true, order: '0' }}
      fields={[
        { key: 'key', label: 'Screen', type: 'select', required: true, lockOnEdit: true, options: screens.map((s) => ({ value: s.key, label: s.label })) },
        { key: 'label', label: 'Menu name', required: true },
        { key: 'group', label: 'Group', type: 'select', required: true, options: GROUPS.map((g) => ({ value: g, label: g })) },
        { key: 'order', label: 'Order', type: 'number' },
        { key: 'active', label: 'Shown', type: 'checkbox' },
      ]}
      columns={[
        { label: 'Order', render: (r) => r.order },
        { label: 'Menu name', render: (r) => r.label },
        { label: 'Group', render: (r) => r.group },
        { label: 'Status', render: (r) => on(r.active) },
      ]}
    />
  )
}

function SubMenus() {
  const [menus, setMenus] = useState<MenuRow[]>([])
  useEffect(() => { api<MenuRow[]>('/config/menus').then(setMenus).catch(() => undefined) }, [])
  return (
    <MasterTable<SubMenuRow>
      endpoint="/config/sub-menus" noun="sub menu"
      note="Only the Miscellaneous menu has sub menus."
      initial={{ active: true, order: '0' }}
      fields={[
        { key: 'menu', label: 'Menu', type: 'select', required: true, lockOnEdit: true, options: menus.filter((m) => m.key === 'misc').map((m) => ({ value: m._id, label: m.label })) },
        { key: 'label', label: 'Screen', type: 'select', required: true, lockOnEdit: true, options: MISC.map((m) => ({ value: m, label: m })) },
        { key: 'order', label: 'Order', type: 'number' },
        { key: 'active', label: 'Shown', type: 'checkbox' },
      ]}
      columns={[
        { label: 'Order', render: (r) => r.order },
        { label: 'Screen', render: (r) => r.label },
        { label: 'Menu', render: (r) => r.menu?.label },
        { label: 'Status', render: (r) => on(r.active) },
      ]}
    />
  )
}

function Roles() {
  const [screens, setScreens] = useState<Screen[]>([])
  useEffect(() => { api<Screen[]>('/config/screens').then(setScreens).catch(() => undefined) }, [])
  return (
    <MasterTable<RoleRow>
      endpoint="/config/roles" noun="role"
      note="The base role decides what the system allows: Admin can use everything, Center only its own center's records. The menus you tick decide what appears in the sidebar. Everyone can change their own password."
      initial={{ active: true, baseRole: 'center' }}
      fields={[
        { key: 'name', label: 'Role name', required: true },
        { key: 'key', label: 'Key', required: true, lockOnEdit: true, placeholder: 'accounts' },
        { key: 'baseRole', label: 'Base role', type: 'select', required: true, lockOnEdit: true, options: [{ value: 'admin', label: 'Admin (head office)' }, { value: 'center', label: 'Center' }] },
        { key: 'active', label: 'Active', type: 'checkbox' },
        {
          key: 'menus', label: 'Menus shown in the sidebar', type: 'multi',
          options: (form) => screens.filter((s) => s.key !== 'change-password' && (form.baseRole === 'admin' || CENTER_MENUS.includes(s.key))).map((s) => ({ value: s.key, label: s.label })),
        },
      ]}
      columns={[
        { label: 'Role', render: (r) => r.name },
        { label: 'Key', render: (r) => r.key },
        { label: 'Base role', render: (r) => (r.baseRole === 'admin' ? 'Admin' : 'Center') },
        { label: 'Menus', render: (r) => r.menus.filter((m) => m !== 'change-password').length },
        { label: 'Status', render: (r) => on(r.active) },
      ]}
    />
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
      {name === 'User Role' && <Roles />}
      {name === 'Financial year' && <FinancialYears />}
      {name === 'State' && <States />}
      {name === 'City' && <Cities />}
      {name === 'Menu' && <Menus />}
      {name === 'Sub Menu' && <SubMenus />}
      {!MISC.includes(name) && (
        <section className="panel empty">
          <p>This screen has not been built yet.</p>
        </section>
      )}
    </>
  )
}

