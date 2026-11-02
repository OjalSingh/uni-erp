import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { errMsg, fmtDate, fmtMoney } from '../format.ts'

export interface InvoiceRow {
  _id: string
  invoiceNo: number
  date: string
  grandTotal: number
  paid: number
  outstanding: number
  payoutStatus: 'Unpaid' | 'Partially paid' | 'Paid'
  center: { code: string; name: string; email?: string; mobile?: string }
}
interface ReportRow {
  center: { _id: string; code: string; name: string }
  invoices: number
  invoiced: number
  received: number
  outstanding: number
}

export default function Books() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [report, setReport] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<InvoiceRow[]>('/invoices').then(setRows).catch((e) => setError(errMsg(e)))
  }, [])

  const toggleReport = () => {
    if (report) return setReport(null)
    api<ReportRow[]>('/invoices/report').then(setReport).catch((e) => setError(errMsg(e)))
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Book Allocated</h1>
        {isAdmin && (
          <span>
            <button className="btn-quiet" onClick={toggleReport}>
              {report ? 'Hide report' : 'Report'}
            </button>{' '}
            <Link to="/books/new" className="btn-create">
              New invoice
            </Link>
          </span>
        )}
      </div>
      {error && <p className="err pad">{error}</p>}

      {report && (
        <section className="panel">
          <div className="panel-head">Amounts by center</div>
          <table className="grid">
            <thead>
              <tr><th>Center</th><th>Invoices</th><th>Invoiced</th><th>Received</th><th>Outstanding</th></tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.center._id}>
                  <td>{r.center.code} - {r.center.name}</td>
                  <td>{r.invoices}</td>
                  <td>{fmtMoney(r.invoiced)}</td>
                  <td>{fmtMoney(r.received)}</td>
                  <td>{fmtMoney(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.length === 0 && <p className="empty-note">No invoices yet.</p>}
        </section>
      )}

      <section className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>Invoice</th><th>Date</th><th>Center</th><th>Email</th><th>Mobile</th><th>Amount</th><th>Paid</th><th>Payout status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.invoiceNo}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.center?.code} - {r.center?.name}</td>
                <td>{r.center?.email}</td>
                <td>{r.center?.mobile}</td>
                <td>{fmtMoney(r.grandTotal)}</td>
                <td>{fmtMoney(r.paid)}</td>
                <td><span className={`status ${r.payoutStatus === 'Paid' ? 'on' : 'off'}`}>{r.payoutStatus}</span></td>
                <td><Link to={`/books/${r._id}`} className="btn-mod">{isAdmin ? 'View or receive payment' : 'View'}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error && <p className="empty-note">No invoices yet.</p>}
      </section>
    </>
  )
}
