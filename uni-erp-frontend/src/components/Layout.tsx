import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.tsx'
import { MISC, MODULES } from '../modules.ts'

export default function Layout() {
  const { user, logout } = useAuth()
  const [miscOpen, setMiscOpen] = useState(false)
  const nav = MODULES.filter((m) => m.path !== 'change-password')
  const changePw = MODULES.find((m) => m.path === 'change-password')!

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">AIECCE</div>
        <span className="welcome">
          Welcome to <b>{user?.username}</b>
        </span>
        <span className="head">Head Office : AIECCE</span>
        <button className="logout" onClick={logout}>
          LOGOUT
        </button>
      </header>
      <aside className="sidebar">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        {nav.map((m) => (
          <NavLink key={m.path} to={`/${m.path}`}>
            {m.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <>
            <button className="navbtn" onClick={() => setMiscOpen((o) => !o)}>
              Miscellaneous <span className="badge">{MISC.length}</span>
            </button>
            {miscOpen &&
              MISC.map((name) => (
                <NavLink key={name} className="sub" to={`/misc/${encodeURIComponent(name)}`}>
                  {name}
                </NavLink>
              ))}
          </>
        )}
        <NavLink to={`/${changePw.path}`}>{changePw.label}</NavLink>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
