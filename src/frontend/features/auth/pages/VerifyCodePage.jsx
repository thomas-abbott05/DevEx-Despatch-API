import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './styles/VerifyPage.css'

export default function VerifyCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { verifyRegistrationCode, requestVerificationCode } = useAuth()
  const hasAutoRequestedRef = useRef(false)

  const initialEmail = useMemo(() => {
    return typeof location.state?.email === 'string' ? location.state.email : ''
  }, [location.state])

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    async function autoRequestCode() {
      if (hasAutoRequestedRef.current || searchParams.get('req') !== '1') {
        return
      }

      const emailValue = email.trim().toLowerCase()
      if (!emailValue) {
        return
      }

      hasAutoRequestedRef.current = true
      setResending(true)
      setError('')

      try {
        const payload = await requestVerificationCode({ email: emailValue })
        setSuccessMessage(payload?.message || 'Verification code sent.')
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setResending(false)
      }
    }

    autoRequestCode()
  }, [email, requestVerificationCode, searchParams])

  async function onSubmit(event) {
    event.preventDefault()

    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const payload = await verifyRegistrationCode({ email, code })
      setSuccessMessage(payload?.message || 'Email verified successfully. You can now log in.')
      navigate('/login', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    setResending(true)
    setError('')
    setSuccessMessage('')

    try {
      const payload = await requestVerificationCode({ email })
      setSuccessMessage(payload?.message || 'Verification code sent.')
    } catch (resendError) {
      setError(resendError.message)
    } finally {
      setResending(false)
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
            <CardDescription>Enter the 6 digit code sent to your email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="verifyEmail">Email address</Label>
              <Input
                id="verifyEmail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <Label htmlFor="verificationCode">Verification code</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="auth-code-input"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              {error ? <p className="auth-error">{error}</p> : null}
              {successMessage ? <p className="auth-success">{successMessage}</p> : null}

              <Button type="submit" variant="secondary" size="lg" className="auth-main-action" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify email'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="auth-secondary-action"
                onClick={onResend}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend code'}
              </Button>

              <p className="auth-link-row auth-link-row-split">
                <Link to="/register" className="link-animated">Back to register</Link>
                <Link to="/login" className="link-animated">Go to login</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
