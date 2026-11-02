import { Fragment, useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { errMsg, fmtDate, fmtMoney, toInputDate } from '../format.ts'

interface Item { _id: string; code: string; name: string }
interface Summary extends Item { totalQty: number; totalSold: number; available: number }
interface Supplier { _id: string; name: string; businessName: string; mobile: string; email?: string; pan?: string; gst?: string; address?: string }
interface Entry {
  _id: string
  supplier: { _id: string; businessName: string }
  item: Item
  purchasePrice: number
  sellPrice: number
  discountPercent: number
  quantity: number
  receivedAt: string
}

const TABS = [
  { view: '', label: 'Stock summary' },
  { view: 'entries', label: 'Add or update stock' },
  { view: 'items', label: 'Items' },
  { view: 'suppliers', label: 'Suppliers' },
]

function Summary() {
  const [rows, setRows] = useState<Summary[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Summary[]>('/stock/summary').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])

  const view = (id: string) => {
    if (openId === id) return setOpenId(null)
    setOpenId(id)
    api<Entry[]>(`/stock/entries?item=${id}`).then(setEntries).catch((e) => setError(errMsg(e)))
  }

  return (
    <section className="panel">
      {error && <p className="err pad">{error}</p>}
      <table className="grid">
        <thead>
          <tr><th>Item code</th><th>Item name</th><th>Total quantity</th><th>Total sold</th><th>Available</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r._id}>
              <tr>
                <td>{r.code}</td><td>{r.name}</td><td>{r.totalQty}</td><td>{r.totalSold}</td>
                <td><span className={`status ${r.available > 0 ? 'on' : 'off'}`}>{r.available}</span></td>
                <td><button className="btn-mod" onClick={() => view(r._id)}>{openId === r._id ? 'Hide' : 'View'}</button></td>
              </tr>
              {openId === r._id && (
                <tr>
                  <td colSpan={6}>
                    {entries.length === 0 ? 'No stock received for this item yet.' : entries.map((e) => (
                      <div key={e._id}>
                        {fmtDate(e.receivedAt)}: {e.quantity} from {e.supplier?.businessName} at {fmtMoney(e.purchasePrice)} (sell {fmtMoney(e.sellPrice)})
                      </div>
                    ))}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="empty-note">No items yet. Add items first, then record stock.</p>}
    </section>
  )
}

function Items() {
  const { can } = useAuth()
  const canManage = can('stock:manage')
  const [rows, setRows] = useState<Item[]>([])
  const [form, setForm] = useState({ code: '', name: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { api<Item[]>('/stock/items').then(setRows).catch((e) => setError(errMsg(e))) }, [])
  useEffect(load, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    try {
      if (editId) await api(`/stock/items/${editId}`, { method: 'PUT', body: { name: form.name } })
      else await api('/stock/items', { method: 'POST', body: form })
      setForm({ code: '', name: '' }); setEditId(null); load()
    } catch (err) { setError(errMsg(err)) }
  }
  const remove = async (i: Item) => {
    if (!window.confirm(`Delete ${i.name}?`)) return
    try { await api(`/stock/items/${i._id}`, { method: 'DELETE' }); load() } catch (err) { setError(errMsg(err)) }
  }

  return (
    <section className="panel">
      {canManage && (
      <form className="toolbar" onSubmit={submit}>
        <input required disabled={Boolean(editId)} placeholder="Item code" aria-label="Item code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <input required placeholder="Item name" aria-label="Item name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <span>
          <button className="btn-save" type="submit">{editId ? 'Save item' : 'Add item'}</button>{' '}
          {editId && <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm({ code: '', name: '' }) }}>Cancel</button>}
        </span>
      </form>
      )}
      {error && <p className="err pad">{error}</p>}
      <table className="grid">
        <thead><tr><th>Item code</th><th>Item name</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i._id}>
              <td>{i.code}</td><td>{i.name}</td>
              <td>
                {canManage && (<><button className="btn-mod" onClick={() => { setEditId(i._id); setForm({ code: i.code, name: i.name }) }}>Modify</button>{' '}
                <button className="btn-del" onClick={() => remove(i)}>Delete</button></>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="empty-note">No items yet.</p>}
    </section>
  )
}

const blankSupplier = { name: '', businessName: '', mobile: '', email: '', pan: '', gst: '', address: '' }

function Suppliers() {
  const { can } = useAuth()
  const canManage = can('stock:manage')
  const [rows, setRows] = useState<Supplier[]>([])
  const [form, setForm] = useState(blankSupplier)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { api<Supplier[]>('/stock/suppliers').then(setRows).catch((e) => setError(errMsg(e))) }, [])
  useEffect(load, [load])
  const set = (k: keyof typeof blankSupplier, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    try {
      if (editId) await api(`/stock/suppliers/${editId}`, { method: 'PUT', body: form })
      else await api('/stock/suppliers', { method: 'POST', body: form })
      setForm(blankSupplier); setEditId(null); load()
    } catch (err) { setError(errMsg(err)) }
  }
  const remove = async (s: Supplier) => {
    if (!window.confirm(`Delete ${s.businessName}?`)) return
    try { await api(`/stock/suppliers/${s._id}`, { method: 'DELETE' }); load() } catch (err) { setError(errMsg(err)) }
  }

  return (
    <section className="panel">
      {canManage && (
      <form className="reg-form" onSubmit={submit}>
        <div className="row">
          <label className="req">Supplier name</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <label className="req">Business name</label><input required value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
        </div>
        <div className="row">
          <label className="req">Mobile</label><input required maxLength={10} inputMode="numeric" value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/\D/g, ''))} />
          <label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="row">
          <label>PAN</label><input maxLength={10} value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} />
          <label>GST no.</label><input maxLength={15} value={form.gst} onChange={(e) => set('gst', e.target.value.toUpperCase())} />
        </div>
        <div className="row"><label>Address</label><textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
        {error && <p className="err pad">{error}</p>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn-save" type="submit">{editId ? 'Save supplier' : 'Add supplier'}</button>{' '}
          {editId && <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm(blankSupplier) }}>Cancel</button>}
        </div>
      </form>
      )}
      <table className="grid">
        <thead><tr><th>Name</th><th>Business name</th><th>Mobile</th><th>Email</th><th>GST no.</th><th>PAN</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s._id}>
              <td>{s.name}</td><td>{s.businessName}</td><td>{s.mobile}</td><td>{s.email}</td><td>{s.gst}</td><td>{s.pan}</td>
              <td>
                {canManage && (<><button className="btn-mod" onClick={() => { setEditId(s._id); setForm({ ...blankSupplier, ...Object.fromEntries(Object.entries(s).filter(([k]) => k in blankSupplier)) } as typeof blankSupplier) }}>Modify</button>{' '}
                <button className="btn-del" onClick={() => remove(s)}>Delete</button></>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="empty-note">No suppliers yet.</p>}
    </section>
  )
}

const blankEntry = { supplier: '', item: '', purchasePrice: '', sellPrice: '', discountPercent: '0', quantity: '', receivedAt: toInputDate(new Date().toISOString()) }

function Entries() {
  const { can } = useAuth()
  const canManage = can('stock:manage')
  const [rows, setRows] = useState<Entry[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [form, setForm] = useState(blankEntry)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { api<Entry[]>('/stock/entries').then(setRows).catch((e) => setError(errMsg(e))) }, [])
  useEffect(() => {
    load()
    api<Supplier[]>('/stock/suppliers').then(setSuppliers).catch(() => undefined)
    api<Item[]>('/stock/items').then(setItems).catch(() => undefined)
  }, [load])
  const set = (k: keyof typeof blankEntry, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    const body = { ...form, purchasePrice: Number(form.purchasePrice), sellPrice: Number(form.sellPrice), discountPercent: Number(form.discountPercent || 0), quantity: Number(form.quantity) }
    try {
      if (editId) await api(`/stock/entries/${editId}`, { method: 'PUT', body })
      else await api('/stock/entries', { method: 'POST', body })
      setForm(blankEntry); setEditId(null); load()
    } catch (err) { setError(errMsg(err)) }
  }
  const remove = async (en: Entry) => {
    if (!window.confirm('Delete this stock entry?')) return
    try { await api(`/stock/entries/${en._id}`, { method: 'DELETE' }); load() } catch (err) { setError(errMsg(err)) }
  }

  return (
    <section className="panel">
      {canManage && (
      <form className="reg-form" onSubmit={submit}>
        <div className="row">
          <label className="req">Supplier</label>
          <select required value={form.supplier} onChange={(e) => set('supplier', e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.businessName}</option>)}
          </select>
          <label className="req">Item</label>
          <select required value={form.item} onChange={(e) => set('item', e.target.value)}>
            <option value="">Select item</option>
            {items.map((i) => <option key={i._id} value={i._id}>{i.code} - {i.name}</option>)}
          </select>
        </div>
        <div className="row">
          <label className="req">Purchase price</label><input required type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
          <label className="req">Sell price</label><input required type="number" min={0} step="0.01" value={form.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} />
          <label>Discount %</label><input type="number" min={0} max={100} step="0.01" value={form.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} />
        </div>
        <div className="row">
          <label className="req">Quantity</label><input required type="number" min={1} step={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          <label>Received on</label><input type="date" value={form.receivedAt} onChange={(e) => set('receivedAt', e.target.value)} />
        </div>
        {error && <p className="err pad">{error}</p>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn-save" type="submit">{editId ? 'Save stock entry' : 'Add stock'}</button>{' '}
          {editId && <button type="button" className="btn-quiet" onClick={() => { setEditId(null); setForm(blankEntry) }}>Cancel</button>}
        </div>
      </form>
      )}
      <table className="grid">
        <thead><tr><th>Supplier</th><th>Item</th><th>Purchase</th><th>Sell</th><th>Discount</th><th>Quantity</th><th>Received</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.supplier?.businessName}</td><td>{r.item?.name}</td><td>{fmtMoney(r.purchasePrice)}</td><td>{fmtMoney(r.sellPrice)}</td>
              <td>{r.discountPercent}%</td><td>{r.quantity}</td><td>{fmtDate(r.receivedAt)}</td>
              <td>
                {canManage && (<><button className="btn-mod" onClick={() => { setEditId(r._id); setForm({ supplier: r.supplier._id, item: r.item._id, purchasePrice: String(r.purchasePrice), sellPrice: String(r.sellPrice), discountPercent: String(r.discountPercent), quantity: String(r.quantity), receivedAt: toInputDate(r.receivedAt) }) }}>Modify</button>{' '}
                <button className="btn-del" onClick={() => remove(r)}>Delete</button></>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="empty-note">No stock recorded yet.</p>}
    </section>
  )
}

export default function Stock() {
  const { view = '' } = useParams()
  return (
    <>
      <h1 className="page-title">Stock Details</h1>
      <nav className="subtabs" aria-label="Stock sections">
        {TABS.map((t) => (
          <Link key={t.view} to={t.view ? `/stock/${t.view}` : '/stock'} className={view === t.view ? 'active' : ''}>
            {t.label}
          </Link>
        ))}
      </nav>
      {view === '' && <Summary />}
      {view === 'entries' && <Entries />}
      {view === 'items' && <Items />}
      {view === 'suppliers' && <Suppliers />}
    </>
  )
}
