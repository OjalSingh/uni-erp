import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.tsx'
import { GROUPS, MISC, MODULES } from '../modules.ts'

export default function Layout() {
  const { user, logout } = useAuth()
  const [miscOpen, setMiscOpen] = useState(false)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">AIECCE</span>
          <span className="brand-sub">Administration</span>
        </div>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          {GROUPS.map((g) => (
            <div key={g} className="nav-group">
              <div className="nav-heading">{g}</div>
              {MODULES.filter((m) => m.group === g).map((m) => (
                <NavLink key={m.path} to={`/${m.path}`}>
                  {m.label}
                </NavLink>
              ))}
              {g === 'Resources' && user?.role === 'admin' && (
                <>
                  <button className="navbtn" aria-expanded={miscOpen} onClick={() => setMiscOpen((o) => !o)}>
                    Miscellaneous
                    <span className="count">{MISC.length}</span>
                  </button>
                  {miscOpen &&
                    MISC.map((name) => (
                      <NavLink key={name} className="sub" to={`/misc/${encodeURIComponent(name)}`}>
                        {name}
                      </NavLink>
                    ))}
                </>
              )}
            </div>
          ))}
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
