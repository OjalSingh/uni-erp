import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from '../api.ts'
import { errMsg } from '../format.ts'

export interface Opt { value: string; label: string; group?: string }
export type Values = Record<string, string | boolean | string[]>
export interface Field {
  key: string
  label: string
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'multi'
  required?: boolean
  options?: Opt[] | ((form: Values) => Opt[])
  lockOnEdit?: boolean
  placeholder?: string
}
interface Column<T> { label: string; render: (r: T) => ReactNode }

const defaults = (fields: Field[], initial: Values): Values =>
  Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? (f.type === 'checkbox' ? false : f.type === 'multi' ? [] : '')]))

// One list-plus-form screen for a simple settings table. The API owns validation; its message is shown as is.
export default function MasterTable<T extends { _id: string; system?: boolean }>({ endpoint, noun, fields, columns, initial = {}, note }: {
  endpoint: string
  noun: string
  fields: Field[]
  columns: Column<T>[]
  initial?: Values
  note?: ReactNode
}) {
  const [rows, setRows] = useState<T[]>([])
  const [form, setForm] = useState<Values>(() => defaults(fields, initial))
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<T[]>(endpoint).then(setRows).catch((e) => setError(errMsg(e)))
  }, [endpoint])
  useEffect(load, [load])

  const reset = () => { setEditId(null); setForm(defaults(fields, initial)) }

  const startEdit = (row: T) => {
    const rec = row as unknown as Record<string, unknown>
    setEditId(row._id)
    setError('')
    setForm(Object.fromEntries(fields.map((f) => {
      const v = rec[f.key]
      if (f.type === 'multi') return [f.key, Array.isArray(v) ? (v as string[]) : []]
      if (f.type === 'checkbox') return [f.key, Boolean(v)]
      if (v && typeof v === 'object') return [f.key, String((v as { _id: string })._id)]
      if (f.type === 'date') return [f.key, v ? String(v).slice(0, 10) : '']
      return [f.key, v === undefined || v === null ? '' : String(v)]
    })))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const body = Object.fromEntries(fields.map((f) => {
      const v = form[f.key]
      if (f.type === 'number') return [f.key, v === '' ? undefined : Number(v)]
      if (f.type === 'date' && v === '') return [f.key, undefined]
      return [f.key, v]
    }))
    try {
      if (editId) await api(`${endpoint}/${editId}`, { method: 'PUT', body })
      else await api(endpoint, { method: 'POST', body })
      reset()
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const remove = async (row: T) => {
    if (!window.confirm(`Delete this ${noun}?`)) return
    setError('')
    try {
      await api(`${endpoint}/${row._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const set = (k: string, v: string | boolean | string[]) => setForm((f) => ({ ...f, [k]: v }))
  const optsFor = (f: Field): Opt[] => (typeof f.options === 'function' ? f.options(form) : f.options ?? [])

  return (
    <section className="panel">
      <form className="reg-form" onSubmit={submit}>
        {note && <p className="hint" style={{ marginBottom: 12 }}>{note}</p>}
        <div className="row">
          {fields.filter((f) => f.type !== 'multi').map((f) => {
            const locked = Boolean(editId && f.lockOnEdit)
            const id = `mt-${f.key}`
            return (
              <span key={f.key} className="field-pair">
                <label htmlFor={id} className={f.required ? 'req' : ''}>{f.label}</label>
                {f.type === 'select' ? (
                  <select id={id} required={f.required} disabled={locked} value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">Select</option>
                    {optsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input id={id} type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
                ) : (
                  <input id={id} type={f.type ?? 'text'} required={f.required} disabled={locked} placeholder={f.placeholder} value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </span>
            )
          })}
        </div>
        {fields.filter((f) => f.type === 'multi').map((f) => {
          const list = form[f.key] as string[]
          const opts = optsFor(f)
          const groups = [...new Set(opts.map((o) => o.group ?? ''))]
          const toggle = (value: string, on: boolean) => set(f.key, on ? [...list, value] : list.filter((x) => x !== value))
          return (
            <fieldset key={f.key} className="checks">
              <legend>{f.label}</legend>
              {groups.map((g) => (
                <div key={g} className="check-group">
                  {g && <strong>{g}</strong>}
                  {opts.filter((o) => (o.group ?? '') === g).map((o) => (
                    <label key={o.value}>
                      <input type="checkbox" checked={list.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} /> {o.label}
                    </label>
                  ))}
                </div>
              ))}
            </fieldset>
          )
        })}
        {error && <p className="err pad" role="alert">{error}</p>}
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn-save" type="submit">{editId ? `Save ${noun}` : `Add ${noun}`}</button>{' '}
          {editId && <button type="button" className="btn-quiet" onClick={reset}>Cancel</button>}
        </div>
      </form>
      <table className="grid">
        <thead>
          <tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}<th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              {columns.map((c) => <td key={c.label}>{c.render(r)}</td>)}
              <td>
                <button className="btn-mod" onClick={() => startEdit(r)}>Modify</button>{' '}
                {!r.system && <button className="btn-del" onClick={() => remove(r)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="empty-note">Nothing here yet.</p>}
    </section>
  )
}
