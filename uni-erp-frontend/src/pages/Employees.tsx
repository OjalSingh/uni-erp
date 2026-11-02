import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import { errMsg } from '../format.ts'

interface Employee {
  _id: string
  username: string
  name: string
  email?: string
  mobile?: string
  role: 'admin' | 'center'
  roleRef?: { key: string; name: string }
  center?: { _id: string; code: string; name: string }
  active: boolean
}
interface RoleOpt {
  key: string
  name: string
  baseRole: 'admin' | 'center'
  active: boolean
}
interface CenterOpt {
  _id: string
  code: string
  name: string
}

const blank = { username: '', name: '', email: '', mobile: '', roleKey: 'center', center: '', password: '', active: true }

export default function Employees() {
  const [rows, setRows] = useState<Employee[]>([])
  const [centers, setCenters] = useState<CenterOpt[]>([])
  const [roles, setRoles] = useState<RoleOpt[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<Employee[]>('/employees').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(() => {
    load()
    api<CenterOpt[]>('/centers').then(setCenters).catch(() => undefined)
    api<RoleOpt[]>('/config/roles').then(setRoles).catch(() => undefined)
  }, [load])

  const set = (k: keyof typeof blank, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (e: Employee) => {
    setEditId(e._id)
    setForm({ username: e.username, name: e.name, email: e.email ?? '', mobile: e.mobile ?? '', roleKey: e.roleRef?.key ?? e.role, center: e.center?._id ?? '', password: '', active: e.active })
    setOpen(true)
    setError('')
  }
  const close = () => {
    setOpen(false)
    setEditId(null)
    setForm(blank)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setError('')
    try {
      if (editId) await api(`/employees/${editId}`, { method: 'PUT', body: form })
      else await api('/employees', { method: 'POST', body: form })
      close()
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Employee Details</h1>
        {!open && (
          <button className="btn-create" onClick={() => setOpen(true)}>
            Add user
          </button>
        )}
      </div>

      {open && (
        <section className="panel">
          <form className="reg-form" onSubmit={submit}>
            <h2 style={{ marginTop: 0 }}>{editId ? 'Modify user' : 'New user'}</h2>
            <div className="row">
              <label className="req">Username</label>
              <input required disabled={Boolean(editId)} value={form.username} onChange={(e) => set('username', e.target.value)} />
              <label className="req">Name</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="row">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              <label>Mobile</label>
              <input inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="row">
              <label className="req">Role</label>
              <select required value={form.roleKey} onChange={(e) => set('roleKey', e.target.value)}>
                {roles.filter((r) => r.active || r.key === form.roleKey).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
              {roles.find((r) => r.key === form.roleKey)?.baseRole === 'center' && (
                <>
                  <label className="req">Center</label>
                  <select required value={form.center} onChange={(e) => set('center', e.target.value)}>
                    <option value="">Select center</option>
                    {centers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="row">
              <label className={editId ? '' : 'req'}>Password</label>
              <input type="password" autoComplete="new-password" required={!editId} minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} />
              <span className="hint">{editId ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}</span>
            </div>
            {editId && (
              <div className="row">
                <label>Status</label>
                <select value={form.active ? 'Active' : 'Inactive'} onChange={(e) => set('active', e.target.value === 'Active')}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            )}
            {error && <p className="err pad">{error}</p>}
            <div className="actions">
              <button type="submit" className="btn-save">
                Save user
              </button>{' '}
              <button type="button" className="btn-quiet" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {!open && error && <p className="err pad">{error}</p>}
      <section className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.username}</td>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.mobile}</td>
                <td>{r.roleRef?.name ?? (r.role === 'admin' ? 'Super Admin' : 'Center')}{r.center && r.role === 'center' ? ` (${r.center.code})` : ''}</td>
                <td>
                  <span className={`status ${r.active ? 'on' : 'off'}`}>{r.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td>
                  <button className="btn-mod" onClick={() => startEdit(r)}>
                    Modify
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
