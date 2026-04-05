import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './styles/ResetPasswordPage.css'

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { resetPassword } = useAuth()

  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()

    if (!token) {
      setError('Reset token is missing or invalid. Request a new reset link.')
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
      const payload = await resetPassword({ token, password: form.password })
      setSuccessMessage(payload?.message || 'Password reset successful. You can now log in.')
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
              <img className="auth-logo auth-logo-login" src="/img/devexlogo2.png" alt="DevEx" />
            </CardTitle>
            <CardDescription>Set your new account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="newPassword">New password</Label>
              <span className="auth-password-requirements">(At least 8 characters, including a letter and a number)</span>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="newPassword"
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

              <Label htmlFor="confirmNewPassword">Repeat password</Label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="confirmNewPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="auth-input-with-icon auth-input-with-toggle"
                  value={form.confirmPassword}
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

              <Button type="submit" variant="secondary" size="lg" className="auth-main-action" disabled={submitting}>
                {submitting ? 'Updating...' : 'Reset password'}
              </Button>

              <p className="auth-link-row auth-link-row-split">
                <Link to="/forgot-password">Request another link</Link>
                <Link to="/login">Back to login</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
