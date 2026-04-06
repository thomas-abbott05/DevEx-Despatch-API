import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './styles/AuthShared.css'

const UNVERIFIED_ACCOUNT_ERROR = 'Email address is not verified yet. Please verify your account before logging in.'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="auth-input-with-icon"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                />
              </div>

              <Label htmlFor="password">Password</Label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="auth-input-with-icon auth-input-with-toggle"
                  value={form.password}
                  onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>

              {error ? <p className="auth-error">{error}</p> : null}
              {error === UNVERIFIED_ACCOUNT_ERROR ? (
                <p className="auth-link-row" style={{ marginTop: '0.2rem' }}>
                  <Link
                    to="/verify"
                    className="link-animated"
                    state={{ email: form.email.trim().toLowerCase() }}
                  >
                    Need a new verification code?
                  </Link>
                </p>
              ) : null}

              <Button type="submit" variant="secondary" size="lg" className="auth-main-action" disabled={submitting} style={{ marginTop: '1.8rem' }}>
                {submitting ? 'Signing in...' : 'Login'}
              </Button>

              <div className="auth-secondary-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="auth-secondary-action"
                  onClick={() => navigate('/register')}
                >
                  Create an account
                </Button>
              </div>

              <p className="auth-link-row">
                <Link to="/forgot-password" className="link-animated">Forgot password?</Link>
              </p>

              <div className="auth-footer" aria-label="Footer links">
                <div className="auth-footer-links">
                  <a className="auth-footer-link" href="mailto:devex@platform.tcore.network">Support</a>
                  <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
                  <a className="auth-footer-link" href="/terms">T&amp;Cs</a>
                  <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
                  <a className="auth-footer-link" href="/privacy">Privacy</a>
                </div>
                <p className="auth-footer-copyright">© 2026 DevEx Team</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
