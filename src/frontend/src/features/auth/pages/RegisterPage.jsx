import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
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
        <Card className="auth-card">
          <CardHeader className="auth-header">
            <CardTitle>
              <img className="auth-logo" src="/img/devexlogo2.png" alt="DevEx" />
            </CardTitle>
            <CardDescription>Let's get started - tell us about you</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={form.firstName}
                onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
              />

              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={form.lastName}
                onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
              />

              <Label htmlFor="registerEmail">Email address</Label>
              <Input
                id="registerEmail"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
              />

              <Label htmlFor="registerPassword">Password</Label>
              <Input
                id="registerPassword"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              />

              <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword || ''}
                    onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                /> 

              {error ? <p className="auth-error">{error}</p> : null}
              {successMessage ? <p className="auth-success">{successMessage}</p> : null}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Register'}
              </Button>

              <p className="auth-link-row">
                <Link to="/login">Already have an account?</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
