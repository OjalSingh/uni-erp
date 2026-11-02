import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.ts'
import { errMsg, fmtMoney } from '../format.ts'

interface CenterOpt { _id: string; code: string; name: string; status: string }
interface Summary { _id: string; code: string; name: string; available: number }
interface EntryLite { item: { _id: string }; sellPrice: number }
interface Line { description: string; item: string; quantity: string; price: string }

const blankLine = (): Line => ({ description: '', item: '', quantity: '', price: '' })

export default function BookNew() {
  const navigate = useNavigate()
  const [centers, setCenters] = useState<CenterOpt[]>([])
  const [items, setItems] = useState<Summary[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [center, setCenter] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [gst, setGst] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<CenterOpt[]>('/centers').then((c) => setCenters(c.filter((x) => x.status === 'Active'))).catch((e) => setError(errMsg(e)))
    api<Summary[]>('/stock/summary').then(setItems).catch(() => undefined)
    // Latest sell price per item (entries come newest first)
    api<EntryLite[]>('/stock/entries').then((es) => {
      const map: Record<string, number> = {}
      for (const e of es) if (!(e.item._id in map)) map[e.item._id] = e.sellPrice
      setPrices(map)
    }).catch(() => undefined)
  }, [])

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const pickItem = (i: number, id: string) => {
    const item = items.find((x) => x._id === id)
    setLine(i, id ? { item: id, description: item ? item.name : '', price: id in prices ? String(prices[id]) : '' } : { item: '' })
  }

  // Preview only; the server recalculates every figure
  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0)
    const gstAmt = (sub * (Number(gst) || 0)) / 100
    return { sub, gstAmt, grand: sub + gstAmt - (Number(discount) || 0) }
  }, [lines, gst, discount])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const body = { center, gstPercent: Number(gst) || 0, discount: Number(discount) || 0, lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), price: Number(l.price), item: l.item || undefined })) }
      const inv = await api<{ _id: string }>('/invoices', { method: 'POST', body })
      navigate(`/books/${inv._id}`)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">New invoice</h1>
        <Link to="/books" className="btn-back">Back to invoices</Link>
      </div>
      <section className="panel">
        <form className="reg-form" onSubmit={submit}>
          <div className="row">
            <label className="req" htmlFor="center">Center</label>
            <select id="center" required value={center} onChange={(e) => setCenter(e.target.value)}>
              <option value="">Select center</option>
              {centers.map((c) => <option key={c._id} value={c._id}>{c.code} - {c.name}</option>)}
            </select>
            <span className="hint">Invoice number and date are set when you save.</span>
          </div>

          <table className="grid">
            <thead>
              <tr><th>#</th><th>Item from stock</th><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th><th aria-label="Remove" /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <select aria-label="Item from stock" value={l.item} onChange={(e) => pickItem(i, e.target.value)}>
                      <option value="">Not from stock</option>
                      {items.map((it) => <option key={it._id} value={it._id}>{it.code} - {it.name} ({it.available} left)</option>)}
                    </select>
                  </td>
                  <td><input required aria-label="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                  <td><input required type="number" min={1} step={1} aria-label="Quantity" style={{ width: 80 }} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                  <td><input required type="number" min={0} step="0.01" aria-label="Unit price" style={{ width: 110 }} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} /></td>
                  <td>{fmtMoney((Number(l.quantity) || 0) * (Number(l.price) || 0))}</td>
                  <td>{lines.length > 1 && <button type="button" className="btn-del" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><button type="button" className="btn-quiet" onClick={() => setLines((ls) => [...ls, blankLine()])}>Add row</button></p>

          <dl className="totals">
            <dt>Sub total</dt><dd>{fmtMoney(totals.sub)}</dd>
            <dt><label htmlFor="gst">GST (%)</label></dt><dd><input id="gst" type="number" min={0} max={100} step="0.01" value={gst} onChange={(e) => setGst(e.target.value)} /></dd>
            <dt>GST amount</dt><dd>{fmtMoney(totals.gstAmt)}</dd>
            <dt><label htmlFor="disc">Discount (₹)</label></dt><dd><input id="disc" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></dd>
            <dt>Grand total</dt><dd><b>{fmtMoney(totals.grand)}</b></dd>
          </dl>

          {error && <p className="err pad" role="alert">{error}</p>}
          <div className="actions">
            <button type="submit" className="btn-save" disabled={busy}>{busy ? 'Saving...' : 'Save invoice'}</button>
          </div>
        </form>
      </section>
    </>
  )
}
