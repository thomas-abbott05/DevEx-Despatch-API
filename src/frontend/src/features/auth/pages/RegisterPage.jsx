import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    profilePhotoUuid: ''
  })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      await register({
        ...form,
        profilePhotoUuid: form.profilePhotoUuid.trim() || null
      })
      setSuccessMessage('Registration successful. You can now log in.')
      navigate('/login', { replace: true })
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

          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
          />

          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={form.firstName}
            onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
          />

          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={form.lastName}
            onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
          />

          <label htmlFor="registerEmail">Email address</label>
          <input
            id="registerEmail"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
          />

          <label htmlFor="registerPassword">Password</label>
          <input
            id="registerPassword"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
          />

          <label htmlFor="profilePhotoUuid">Profile photo UUID (optional)</label>
          <input
            id="profilePhotoUuid"
            type="text"
            value={form.profilePhotoUuid}
            onChange={(event) => setForm((previous) => ({ ...previous, profilePhotoUuid: event.target.value }))}
          />

          {error ? <p className="auth-error">{error}</p> : null}
          {successMessage ? <p className="auth-success">{successMessage}</p> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Register'}
          </button>

          <p className="auth-link-row">
            <Link to="/login">Already have an account?</Link>
          </p>
        </form>
      </section>
    </MeshGradientBackground>
  )
}
