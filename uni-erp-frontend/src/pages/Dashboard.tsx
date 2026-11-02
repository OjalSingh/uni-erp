import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { MODULES } from '../modules.ts'

interface Stats {
  totalStudents: number
  registrationsThisMonth: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api<Stats>('/dashboard').then(setStats).catch(() => setStats(null))
  }, [])

  return (
    <>
      <h2 className="welcome-title">Welcome to AIECCE</h2>
      <div className="tiles">
        {MODULES.map((m) => (
          <Link key={m.path} to={`/${m.path}`} className="tile" style={{ background: m.color }}>
            {m.label}
          </Link>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">Application Analytics</div>
        <div className="stats">
          <div className="stat">
            <b>{stats?.totalStudents ?? '-'}</b>
            <span>Total Student (All center)</span>
          </div>
          <div className="stat">
            <b>{stats?.registrationsThisMonth ?? '-'}</b>
            <span>Registration (This month)</span>
          </div>
        </div>
      </section>
    </>
  )
}
