import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        <Card className="auth-card">
          <CardHeader className="auth-header">
            <CardTitle>
              <img className="auth-logo auth-logo-login" src="/img/devexlogo2.png" alt="DevEx" />
            </CardTitle>
            <CardDescription>UBL 2.4 Document Management Platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
              />

              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              />

              {error ? <p className="auth-error">{error}</p> : null}

              <Button type="submit" variant="secondary" size="lg" className="auth-main-action" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Login'}
              </Button>

              <div className="auth-secondary-actions">
                <Button asChild variant="secondary" size="lg" className="auth-secondary-action">
                  <Link to="/register">Create an account</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="auth-secondary-action">
                  <Link to="/forgot-password">Forgot password?</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
