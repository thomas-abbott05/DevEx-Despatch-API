import { useState } from 'react'
import { Link } from 'react-router-dom'
import MeshGradientBackground from '../components/MeshGradientBackground'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      // Prototype flow: keep UX in place until reset-email backend endpoint is introduced.
      await new Promise((resolve) => setTimeout(resolve, 600))
      setSuccessMessage('If an account exists for this email, password reset instructions will be sent.')
      setEmail('')
    } catch {
      setError('Unable to process your request right now. Please try again.')
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
              <img className="auth-logo" src="/img/devexlogo.png" alt="DevEx" />
            </CardTitle>
            <CardDescription>Enter your email to request a password reset.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={onSubmit}>
              <Label htmlFor="forgotEmail">Email address</Label>
              <Input
                id="forgotEmail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              {error ? <p className="auth-error">{error}</p> : null}
              {successMessage ? <p className="auth-success">{successMessage}</p> : null}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Send reset link'}
              </Button>

              <p className="auth-link-row auth-link-row-split">
                <Link to="/login">Back to login</Link>
                <Link to="/register">Create an account</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </MeshGradientBackground>
  )
}
