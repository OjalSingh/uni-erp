import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import { useNavigation } from '../nav.ts'
import { GROUPS, MODULES } from '../modules.ts'

interface Stats {
  totalStudents: number
  registrationsThisMonth: number
}

export default function Dashboard() {
  const menus = useNavigation()
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
        {[...GROUPS, ...menus.map((m) => m.group).filter((g) => !GROUPS.includes(g))]
          .filter((g, i, a) => a.indexOf(g) === i && menus.some((m) => m.group === g))
          .map((g) => (
            <section key={g}>
              <h2>{g}</h2>
              <ul>
                {menus
                  .filter((m) => m.group === g)
                  .flatMap((m) =>
                    m.submenus.length > 0
                      ? m.submenus.map((s) => ({ to: `/misc/${encodeURIComponent(s.label)}`, label: s.label, note: 'Master data used across the app' }))
                      : [{ to: `/${m.key}`, label: m.label, note: MODULES.find((x) => x.path === m.key)?.note ?? '' }]
                  )
                  .map((item) => (
                    <li key={item.to}>
                      <Link to={item.to}>
                        <span className="d-label">{item.label}</span>
                        <span className="d-note">{item.note}</span>
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
