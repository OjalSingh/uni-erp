import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.tsx'
import { useNavigation } from '../nav.ts'
import { GROUPS } from '../modules.ts'

export default function Layout() {
  const { user, logout } = useAuth()
  const menus = useNavigation()
  const [openKey, setOpenKey] = useState<string | null>(null)

  // Known groups first, in their usual order, then any group an admin has introduced
  const groups = [...GROUPS, ...menus.map((m) => m.group).filter((g) => !GROUPS.includes(g))].filter((g, i, a) => a.indexOf(g) === i)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/branding/seal.png" alt="" />
          <span>
            <span className="brand-name">AIECCE</span>
            <span className="brand-sub">Administration</span>
          </span>
        </div>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          {groups.map((g) => {
            const inGroup = menus.filter((m) => m.group === g)
            if (inGroup.length === 0) return null
            return (
              <div key={g} className="nav-group">
                <div className="nav-heading">{g}</div>
                {inGroup.map((m) =>
                  m.submenus.length > 0 || m.key === 'misc' ? (
                    <div key={m.key}>
                      <button className="navbtn" aria-expanded={openKey === m.key} onClick={() => setOpenKey(openKey === m.key ? null : m.key)}>
                        {m.label}
                        <span className="count">{m.submenus.length}</span>
                      </button>
                      {openKey === m.key &&
                        m.submenus.map((s) => (
                          <NavLink key={s.label} className="sub" to={`/misc/${encodeURIComponent(s.label)}`}>
                            {s.label}
                          </NavLink>
                        ))}
                    </div>
                  ) : (
                    <NavLink key={m.key} to={`/${m.key}`}>
                      {m.label}
                    </NavLink>
                  )
                )}
              </div>
            )
          })}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="who">
            <b>{user?.name}</b>
            <span>{user?.role === 'admin' ? 'Head office' : 'Study center'}</span>
          </div>
          <button className="btn-quiet" onClick={logout}>
            Log out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
