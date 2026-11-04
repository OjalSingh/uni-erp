import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.tsx'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <img className="login-logo" src="/branding/seal.png" alt="AIECCE" />
        <h1>
          Advance Information in Early Childhood Care &amp; Education
        </h1>
        <p>Student registration, examinations and certification for AIECCE study centers.</p>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} aria-labelledby="signin">
          <h2 id="signin">Sign in</h2>
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="form-error" role="alert">
            {error}
          </p>
          <button type="submit" className="btn-primary" disabled={busy || !username || !password}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="login-student">
            Student? <Link to="/result">Check your result</Link> · <Link to="/">Back to website</Link>
          </p>
        </form>
      </section>
    </div>
  )
}
