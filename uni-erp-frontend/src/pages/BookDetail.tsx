import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { INSTITUTE_NAME } from '../constants.ts'
import { errMsg, fmtDate, fmtMoney, toInputDate } from '../format.ts'

interface Invoice {
  _id: string
  invoiceNo: number
  date: string
  center: { code: string; name: string; address?: string; email?: string; mobile?: string }
  lines: { description: string; quantity: number; price: number; total: number }[]
  subTotal: number
  gstPercent: number
  gstAmount: number
  discount: number
  grandTotal: number
  paid: number
  outstanding: number
  payoutStatus: string
  payments: { _id: string; amount: number; mode: string; paidAt: string; reference?: string }[]
}

const MODES = ['Cash', 'Cheque', 'Bank transfer', 'UPI', 'Other']

export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [inv, setInv] = useState<Invoice | null>(null)
  const [pay, setPay] = useState({ amount: '', mode: 'Cash', paidAt: toInputDate(new Date().toISOString()), reference: '' })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<Invoice>(`/invoices/${id}`).then((d) => { setInv(d); setPay((p) => ({ ...p, amount: d.outstanding > 0 ? String(d.outstanding) : '' })) }).catch((e) => setError(errMsg(e)))
  }, [id])
  useEffect(load, [load])

  const receive = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api(`/invoices/${id}/payments`, { method: 'POST', body: { ...pay, amount: Number(pay.amount) } })
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this invoice? Its stock goes back to available.')) return
    try {
      await api(`/invoices/${id}`, { method: 'DELETE' })
      navigate('/books')
    } catch (err) {
      setError(errMsg(err))
    }
  }

  if (!inv) return <>{error ? <p className="err pad">{error}</p> : <p>Loading...</p>}</>

  return (
    <>
      <div className="page-head no-print">
        <h1 className="page-title">Invoice {inv.invoiceNo}</h1>
        <span>
          <button className="btn-quiet" onClick={() => window.print()}>Print</button>{' '}
          <Link to="/books" className="btn-back">Back to invoices</Link>
        </span>
      </div>
      {error && <p className="err pad no-print" role="alert">{error}</p>}

      <section className="panel invoice-sheet">
        <div className="invoice-head">
          <b>{INSTITUTE_NAME}</b>
          <span>Invoice {inv.invoiceNo} dated {fmtDate(inv.date)}</span>
        </div>
        <p className="bill-to">
          <b>{inv.center.code} - {inv.center.name}</b><br />
          {inv.center.address}{inv.center.address ? <br /> : null}
          {inv.center.mobile} {inv.center.email}
        </p>
        <table className="grid">
          <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}><td>{i + 1}</td><td>{l.description}</td><td>{l.quantity}</td><td>{fmtMoney(l.price)}</td><td>{fmtMoney(l.total)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="totals">
          <dt>Sub total</dt><dd>{fmtMoney(inv.subTotal)}</dd>
          <dt>GST ({inv.gstPercent}%)</dt><dd>{fmtMoney(inv.gstAmount)}</dd>
          <dt>Discount</dt><dd>{fmtMoney(inv.discount)}</dd>
          <dt>Grand total</dt><dd><b>{fmtMoney(inv.grandTotal)}</b></dd>
          <dt>Received</dt><dd>{fmtMoney(inv.paid)}</dd>
          <dt>Outstanding</dt><dd><b>{fmtMoney(inv.outstanding)}</b> ({inv.payoutStatus})</dd>
        </dl>
      </section>

      <section className="panel no-print">
        <div className="panel-head">Payments received</div>
        {inv.payments.length > 0 && (
          <table className="grid">
            <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead>
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p._id}><td>{fmtDate(p.paidAt)}</td><td>{fmtMoney(p.amount)}</td><td>{p.mode}</td><td>{p.reference}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {inv.payments.length === 0 && <p className="empty-note">No payments recorded yet.</p>}
        {isAdmin && inv.outstanding > 0 && (
          <form className="toolbar" onSubmit={receive}>
            <label>Amount <input required type="number" min={0.01} step="0.01" max={inv.outstanding} value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} /></label>
            <label>Mode <select value={pay.mode} onChange={(e) => setPay((p) => ({ ...p, mode: e.target.value }))}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label>Date <input type="date" value={pay.paidAt} onChange={(e) => setPay((p) => ({ ...p, paidAt: e.target.value }))} /></label>
            <input placeholder="Cheque or reference no." aria-label="Reference" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} />
            <button className="btn-save" type="submit">Receive payment</button>
          </form>
        )}
        {isAdmin && inv.payments.length === 0 && (
          <div className="toolbar"><button className="btn-del" onClick={remove}>Delete invoice</button></div>
        )}
      </section>
    </>
  )
}
