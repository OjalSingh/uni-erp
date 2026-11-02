import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api.ts'
import { errMsg } from '../format.ts'

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setDone(false)
    if (form.newPassword.length < 8) return setError('New password must be at least 8 characters')
    if (form.newPassword !== form.confirm) return setError('The new passwords do not match')
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      setDone(true)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <>
      <h1 className="page-title">Change Password</h1>
      <section className="panel" style={{ maxWidth: 520 }}>
        <form className="reg-form" onSubmit={submit}>
          <div className="row">
            <label className="req" htmlFor="cur">Current password</label>
            <input id="cur" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} />
          </div>
          <div className="row">
            <label className="req" htmlFor="new">New password</label>
            <input id="new" type="password" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} />
          </div>
          <div className="row">
            <label className="req" htmlFor="conf">Confirm new password</label>
            <input id="conf" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
          </div>
          {error && <p className="err pad" role="alert">{error}</p>}
          {done && <p className="ok pad" role="status">Password updated.</p>}
          <div className="actions">
            <button type="submit" className="btn-save">
              Update password
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
