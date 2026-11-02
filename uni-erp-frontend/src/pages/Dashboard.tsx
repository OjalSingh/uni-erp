import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { GROUPS, MODULES } from '../modules.ts'

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
      <h1 className="page-title">Dashboard</h1>

      <div className="figures">
        <div>
          <span className="figure">{stats?.totalStudents ?? '–'}</span>
          <span className="figure-label">Students across all centers</span>
        </div>
        <div>
          <span className="figure">{stats?.registrationsThisMonth ?? '–'}</span>
          <span className="figure-label">Registered this month</span>
        </div>
      </div>

      <div className="directory">
        {GROUPS.map((g) => (
          <section key={g}>
            <h2>{g}</h2>
            <ul>
              {MODULES.filter((m) => m.group === g).map((m) => (
                <li key={m.path}>
                  <Link to={`/${m.path}`}>
                    <span className="d-label">{m.label}</span>
                    <span className="d-note">{m.built ? m.note : `${m.note} (coming soon)`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
