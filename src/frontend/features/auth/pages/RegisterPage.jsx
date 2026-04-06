import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './styles/RegisterPage.css'

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const turnstileSiteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()

    if (!turnstileToken) {
      setError('Please complete the Turnstile challenge before creating your account.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!PASSWORD_COMPLEXITY_REGEX.test(form.password)) {
      setError('Password must include at least one letter and one number.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        turnstileToken
      })
      setSuccessMessage('Registration successful. Please verify the 6 digit code sent to your email.')
      navigate('/verify?req=1', {
        replace: true,
        state: { email: form.email.trim().toLowerCase() }
      })
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
            <CardDescription>Create a new DevEx account</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="firstName">First name</Label>
              <div className="auth-input-wrap">
                <UserRound className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="auth-input-with-icon"
                  value={form.firstName}
                  onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
                />
              </div>

              <Label htmlFor="lastName">Last name</Label>
              <div className="auth-input-wrap">
                <UserRound className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="auth-input-with-icon"
                  value={form.lastName}
                  onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
                />
              </div>

              <Label htmlFor="registerEmail">Email address</Label>
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="registerEmail"
                  type="email"
                  autoComplete="email"
                  required
                  className="auth-input-with-icon"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                />
              </div>

              <Label htmlFor="registerPassword">Password</Label>
              <span className="auth-password-requirements">(At least 8 characters, including a letter and a number)</span>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="registerPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

              <Label htmlFor="confirmPassword">Repeat password</Label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="auth-input-with-icon auth-input-with-toggle"
                  value={form.confirmPassword || ''}
                  onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((previous) => !previous)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>

              {error ? <p className="auth-error">{error}</p> : null}
              {successMessage ? <p className="auth-success">{successMessage}</p> : null}

              <div className="auth-turnstile-block">
                <Turnstile
                  siteKey={turnstileSiteKey}
                  options={{ theme: 'dark' }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
              </div>

              <Button type="submit" className="auth-main-action" disabled={submitting || !turnstileToken}>
                {submitting ? 'Creating account...' : 'Register'}
              </Button>

              <p className="auth-link-row">
                <Link to="/login" className="link-animated">Already have an account?</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
