import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await login(form)
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MeshGradientBackground>
      <section className="auth-screen">
        <form className="auth-card" onSubmit={onSubmit}>
          <header className="auth-header">
            <h1>DevEx</h1>
            <p>UBL Document Management Platform</p>
          </header>

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>

          <p className="auth-link-row">
            <Link to="/register">No account yet?</Link>
          </p>
        </form>
      </section>
    </MeshGradientBackground>
  )
}
