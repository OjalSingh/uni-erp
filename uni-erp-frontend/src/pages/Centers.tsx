import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { useStates } from '../lookups.ts'
import { errMsg } from '../format.ts'

interface Center {
  _id: string
  code: string
  name: string
  address?: string
  state?: string
  city?: string
  pinCode?: string
  email?: string
  mobile?: string
  qualification?: string
  instituteProperty?: string
  currentOccupation?: string
  ownerFirstName?: string
  ownerLastName?: string
  ownerMobile?: string
  ownerEmail?: string
  status: string
}

const blank = {
  code: '', name: '', address: '', state: '', city: '', pinCode: '', email: '', mobile: '', qualification: '', instituteProperty: '',
  currentOccupation: '', ownerFirstName: '', ownerLastName: '', ownerMobile: '', ownerEmail: '', status: 'Active',
}
type Form = typeof blank

export default function Centers() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [rows, setRows] = useState<Center[]>([])
  const [form, setForm] = useState<Form>(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const stateNames = useStates()

  const load = useCallback(() => {
    api<Center[]>('/centers').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const close = () => { setOpen(false); setEditId(null); setForm(blank); setError('') }

  const startEdit = (c: Center) => {
    setEditId(c._id)
    setForm(Object.fromEntries(Object.keys(blank).map((k) => [k, (c as unknown as Record<string, string | undefined>)[k] ?? ''])) as Form)
    setOpen(true)
    setError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editId) await api(`/centers/${editId}`, { method: 'PUT', body: form })
      else await api('/centers', { method: 'POST', body: form })
      close()
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const deactivate = async (c: Center) => {
    if (!window.confirm(`Deactivate ${c.name}?`)) return
    try {
      await api(`/centers/${c._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const text = (k: keyof Form, label: string, extra: { required?: boolean; disabled?: boolean; type?: string; maxLength?: number; digits?: boolean } = {}) => (
    <>
      <label className={extra.required ? 'req' : ''}>{label}</label>
      <input
        required={extra.required}
        disabled={extra.disabled}
        type={extra.type ?? 'text'}
        maxLength={extra.maxLength}
        value={form[k]}
        onChange={(e) => set(k, extra.digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
      />
    </>
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Center Details</h1>
        {isAdmin && !open && (
          <button className="btn-create" onClick={() => setOpen(true)}>
            Add new center
          </button>
        )}
      </div>

      {open && (
        <section className="panel">
          <form className="reg-form" onSubmit={submit}>
            <h2 style={{ marginTop: 0 }}>Center information</h2>
            <div className="row">{text('code', 'Center code', { required: true, disabled: Boolean(editId) })}{text('name', 'Center name', { required: true })}</div>
            <div className="row">{text('address', 'Center address')}</div>
            <div className="row">{text('mobile', 'Center mobile', { maxLength: 10, digits: true })}{text('email', 'Center email', { type: 'email' })}</div>
            <div className="row">
              <label>State</label>
              <select value={form.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">Select state</option>
                {stateNames.map((s) => <option key={s}>{s}</option>)}
              </select>
              {text('city', 'City')}
              {text('pinCode', 'Pin code', { maxLength: 6, digits: true })}
            </div>
            <div className="row">{text('qualification', 'Qualification')}{text('instituteProperty', 'Institute property')}{text('currentOccupation', 'Current occupation')}</div>
            <h2>Owner information</h2>
            <div className="row">{text('ownerFirstName', 'First name')}{text('ownerLastName', 'Last name')}</div>
            <div className="row">{text('ownerMobile', 'Owner mobile', { maxLength: 10, digits: true })}{text('ownerEmail', 'Owner email', { type: 'email' })}</div>
            {editId && (
              <div className="row">
                <label>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            )}
            {error && <p className="err pad">{error}</p>}
            <div className="actions">
              <button type="submit" className="btn-save">Save center</button>{' '}
              <button type="button" className="btn-quiet" onClick={close}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {!open && error && <p className="err pad">{error}</p>}
      <section className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Center name</th>
              <th>City</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Status</th>
              {isAdmin && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.city}</td>
                <td>{c.email}</td>
                <td>{c.mobile}</td>
                <td><span className={`status ${c.status === 'Active' ? 'on' : 'off'}`}>{c.status}</span></td>
                {isAdmin && (
                  <td>
                    <button className="btn-mod" onClick={() => startEdit(c)}>Modify</button>{' '}
                    {c.status === 'Active' && <button className="btn-del" onClick={() => deactivate(c)}>Deactivate</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error && <p className="empty-note">No centers yet.</p>}
      </section>
    </>
  )
}
