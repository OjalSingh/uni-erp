import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, getToken } from '../api.ts'
import MasterTable from '../components/MasterTable.tsx'
import { errMsg, fmtDate } from '../format.ts'
import { GROUPS, MISC } from '../modules.ts'
import { useSessions } from '../lookups.ts'
import { KIND_LABEL } from '../templates.ts'
import type { PrintTemplate, TemplateKind } from '../templates.ts'

interface CourseType {
  _id: string
  name: string
}
interface Course {
  _id: string
  name: string
  code?: string
  parts: number
  durationYears?: number
  courseType: CourseType
}
interface Subject {
  _id: string
  name: string
  code?: string
  part: number
  type?: 'Theory' | 'Practical'
  maxMarks?: number
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

const blankCourse = { courseType: '', name: '', code: '', parts: '1', durationYears: '' }

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
      const body = { ...form, parts: Number(form.parts), durationYears: form.durationYears === '' ? undefined : Number(form.durationYears) }
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
        <label>
          Duration (years){' '}
          <input type="number" min={0.25} max={6} step={0.25} style={{ width: 80 }} value={form.durationYears} onChange={(e) => set('durationYears', e.target.value)} />
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
            <th>Duration</th>
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
              <td>{r.durationYears ? (r.durationYears < 1 ? `${Math.round(r.durationYears * 12)} months` : `${r.durationYears} year${r.durationYears === 1 ? '' : 's'}`) : ''}</td>
              <td>
                <button
                  className="btn-mod"
                  onClick={() => { setEditId(r._id); setForm({ courseType: r.courseType?._id ?? '', name: r.name, code: r.code ?? '', parts: String(r.parts), durationYears: r.durationYears === undefined ? '' : String(r.durationYears) }) }}
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

const blankSubject = { name: '', code: '', type: '', maxMarks: '' }

function Subjects() {
  const [courses, setCourses] = useState<Course[]>([])
  const [course, setCourse] = useState('')
  const [part, setPart] = useState(1)
  const [rows, setRows] = useState<Subject[]>([])
  const [form, setForm] = useState(blankSubject)
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
      const body = { ...form, type: form.type || undefined, maxMarks: form.maxMarks === '' ? undefined : Number(form.maxMarks) }
      if (editId) await api(`/masters/subjects/${editId}`, { method: 'PUT', body: { ...body, part } })
      else await api('/masters/subjects', { method: 'POST', body: { ...body, course, part } })
      setForm(blankSubject)
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
        <input placeholder="Paper (I, II ...)" aria-label="Paper" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <select aria-label="Theory or practical" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
          <option value="">Type</option>
          <option>Theory</option>
          <option>Practical</option>
        </select>
        <input type="number" min={0} placeholder="Max marks" aria-label="Maximum marks" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))} />
        <span>
          <button className="btn-save" type="submit" disabled={!course}>
            {editId ? 'Save subject' : 'Add subject'}
          </button>{' '}
          {editId && (
            <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm(blankSubject) }}>
              Cancel
            </button>
          )}
        </span>
      </form>
      <Notice error={error} />
      {rows.length > 0 && (
        <p className="hint pad">
          {['Theory', 'Practical'].map((t) => {
            const list = rows.filter((r) => r.type === t)
            return list.length ? `${t}: ${list.length} paper${list.length === 1 ? '' : 's'}, ${list.reduce((n, r) => n + (r.maxMarks ?? 0), 0)} marks` : null
          }).filter(Boolean).join('  ·  ')}
          {'  ·  '}Total: {rows.reduce((n, r) => n + (r.maxMarks ?? 0), 0)} marks. Marks can only be entered once every subject has a type and maximum.
        </p>
      )}
      <table className="grid">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Paper</th>
            <th>Type</th>
            <th>Max marks</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.name}</td>
              <td>{r.code}</td>
              <td>{r.type}</td>
              <td>{r.maxMarks}</td>
              <td>
                <button className="btn-mod" onClick={() => { setEditId(r._id); setForm({ name: r.name, code: r.code ?? '', type: r.type ?? '', maxMarks: r.maxMarks === undefined ? '' : String(r.maxMarks) }) }}>
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
interface RoleRow { _id: string; key: string; name: string; baseRole: 'admin' | 'center'; permissions?: string[]; active: boolean; system: boolean }
interface PermissionDef { key: string; label: string; group: string; scopes: string[] }
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
  const [perms, setPerms] = useState<PermissionDef[]>([])
  useEffect(() => { api<PermissionDef[]>('/config/permissions').then(setPerms).catch(() => undefined) }, [])
  return (
    <MasterTable<RoleRow>
      endpoint="/config/roles" noun="role"
      note="A role is a level of user. Tick what it may do: the server checks this on every action, and the sidebar only shows what a user can open. 'Own center only' roles can never be given head-office permissions. You can only give permissions you hold yourself."
      initial={{ active: true, baseRole: 'center', permissions: [] }}
      fields={[
        { key: 'name', label: 'Role name', required: true },
        { key: 'key', label: 'Key', required: true, lockOnEdit: true, placeholder: 'accounts' },
        { key: 'baseRole', label: 'Can see', type: 'select', required: true, lockOnEdit: true, options: [{ value: 'admin', label: 'Records of all centers' }, { value: 'center', label: 'Own center only' }] },
        { key: 'active', label: 'Active', type: 'checkbox' },
        {
          key: 'permissions', label: 'Permissions', type: 'multi',
          options: (form) => perms.filter((p) => form.baseRole !== 'center' || p.scopes.includes('center')).map((p) => ({ value: p.key, label: p.label, group: p.group })),
        },
      ]}
      columns={[
        { label: 'Role', render: (r) => r.name },
        { label: 'Key', render: (r) => r.key },
        { label: 'Can see', render: (r) => (r.baseRole === 'admin' ? 'All centers' : 'Own center only') },
        { label: 'Permissions', render: (r) => (r.permissions ? r.permissions.length : 'default') },
        { label: 'Status', render: (r) => on(r.active) },
      ]}
    />
  )
}

const blankTpl = { kind: 'certificate' as TemplateKind, name: '', session: '', course: '', duration: '', dx: '0', dy: '0' }

// Head office uploads a full-page image per document type; optionally limited to one session and/or course.
function PrintTemplates() {
  const { sessions } = useSessions()
  const [courses, setCourses] = useState<Course[]>([])
  const [rows, setRows] = useState<PrintTemplate[]>([])
  const [form, setForm] = useState(blankTpl)
  const [file, setFile] = useState<File | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const set = (k: keyof typeof blankTpl, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    api<PrintTemplate[]>('/templates').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])
  useEffect(() => { api<Course[]>('/masters/courses').then(setCourses).catch(() => undefined) }, [])

  const reset = () => { setForm(blankTpl); setFile(null); setEditId(null) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!editId && !file) return setError('Choose the template image first')
    const fd = new FormData()
    if (!editId) fd.append('kind', form.kind)
    fd.append('name', form.name)
    fd.append('session', form.session)
    fd.append('course', form.course)
    fd.append('duration', form.duration)
    fd.append('dx', form.dx)
    fd.append('dy', form.dy)
    if (file) fd.append('image', file)
    try {
      const res = await fetch(editId ? `/api/templates/${editId}` : '/api/templates', { method: editId ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Upload failed')
      reset()
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const toggle = (t: PrintTemplate) =>
    api(`/templates/${t._id}`, { method: 'PUT', body: { active: !t.active } }).then(load).catch((e) => setError(errMsg(e)))
  const remove = (t: PrintTemplate) => {
    if (!window.confirm(`Delete the template "${t.name}"? Printing falls back to the next best template or the built-in design.`)) return
    api(`/templates/${t._id}`, { method: 'DELETE' }).then(load).catch((e) => setError(errMsg(e)))
  }

  return (
    <section className="panel">
      <p className="hint pad">
        Upload the blank design (jpg or png, up to 8 MB, A4 portrait for certificates and statements) and choose where it applies. For each print the most specific
        template wins: a named course, then the course length, then the session, then one set for everything. With none, the built-in design is used.
      </p>
      <form className="toolbar" onSubmit={submit}>
        <select required disabled={Boolean(editId)} value={form.kind} onChange={(e) => set('kind', e.target.value)} aria-label="Document type">
          {(Object.keys(KIND_LABEL) as TemplateKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <input required placeholder="Template name" aria-label="Template name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <select value={form.session} onChange={(e) => set('session', e.target.value)} aria-label="Session">
          <option value="">All sessions</option>
          {sessions.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={form.course} onChange={(e) => set('course', e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={form.duration} onChange={(e) => set('duration', e.target.value)} aria-label="Course length">
          <option value="">Any course length</option>
          <option value="1">One year courses</option>
          <option value="2">Two year courses</option>
          <option value="3">Three year courses</option>
        </select>
        <label>Right (mm) <input type="number" step="0.5" style={{ width: 64 }} value={form.dx} onChange={(e) => set('dx', e.target.value)} /></label>
        <label>Down (mm) <input type="number" step="0.5" style={{ width: 64 }} value={form.dy} onChange={(e) => set('dy', e.target.value)} /></label>
        <input type="file" accept="image/jpeg,image/png" aria-label="Template image" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <span>
          <button className="btn-save" type="submit">{editId ? 'Save template' : 'Upload template'}</button>{' '}
          {editId && <button type="button" className="btn-quiet" onClick={reset}>Cancel</button>}
        </span>
      </form>
      {editId && <p className="hint pad">Choose a new image only if you want to replace the current one.</p>}
      <Notice error={error} />
      <table className="grid">
        <thead>
          <tr><th>Preview</th><th>Document</th><th>Name</th><th>Session</th><th>Course</th><th>Length</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t._id}>
              <td><a href={t.image} target="_blank" rel="noreferrer"><img src={t.image} alt={t.name} style={{ height: 48, border: '1px solid #ccc' }} /></a></td>
              <td>{KIND_LABEL[t.kind]}</td>
              <td>{t.name}</td>
              <td>{t.session || 'All'}</td>
              <td>{t.course?.name ?? 'All'}</td>
              <td>{t.duration ? `${t.duration} yr` : 'Any'}</td>
              <td>{t.active ? 'On' : 'Off'}</td>
              <td>
                <button className="btn-mod" onClick={() => { setEditId(t._id); setFile(null); setForm({ kind: t.kind, name: t.name, session: t.session, course: t.course?._id ?? '', duration: t.duration ? String(t.duration) : '', dx: String(t.dx), dy: String(t.dy) }) }}>Modify</button>{' '}
                <button className="btn-quiet" onClick={() => toggle(t)}>{t.active ? 'Switch off' : 'Switch on'}</button>{' '}
                <button className="btn-quiet" onClick={() => remove(t)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-note">No templates uploaded. Printing uses the built-in designs.</p>}
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
      {name === 'Print Templates' && <PrintTemplates />}
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

