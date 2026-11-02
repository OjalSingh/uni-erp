import { useEffect, useState } from 'react'
import { api } from '../api.ts'

interface Center {
  _id: string
  code: string
  name: string
  email?: string
  mobile?: string
  status: string
}

export default function Centers() {
  const [rows, setRows] = useState<Center[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Center[]>('/centers').then(setRows).catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section className="panel">
      <div className="panel-head">Show Center Details</div>
      {error && <p className="err pad">{error}</p>}
      <table className="grid">
        <thead>
          <tr>
            <th>Code</th>
            <th>Center Name</th>
            <th>Email ID</th>
            <th>Mobile No</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c._id}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>{c.email}</td>
              <td>{c.mobile}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
