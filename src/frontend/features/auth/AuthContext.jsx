import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const MIN_AUTH_LOADER_MS = 800

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function readResponsePayload(response) {
  try {
    const responseText = await response.text()

    if (!responseText) {
      return null
    }

    try {
      return JSON.parse(responseText)
    } catch {
      return responseText
    }
  } catch {
    return null
  }
}

function getErrorMessage(payload, fallbackMessage) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors
      .map((error) => (typeof error === 'string' ? error : String(error)))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  if (typeof payload?.reason === 'string' && payload.reason.trim()) {
    return payload.reason.trim()
  }

  return fallbackMessage
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initialising, setInitialising] = useState(true)
  const [initialSessionResolved, setInitialSessionResolved] = useState(false)

  const refreshSession = useCallback(async () => {
    const initialisingStart = Date.now()

    try {
      const response = await fetch('/api/v1/auth/session', {
        method: 'GET',
        credentials: 'include'
      })
      const payload = await readResponsePayload(response)

      if (!response.ok || !payload?.user) {
        setUser(null)
        return null
      }

      setUser(payload.user)
      return payload.user
    } catch {
      setUser(null)
      return null
    } finally {
      const elapsedMs = Date.now() - initialisingStart
      const remainingMs = Math.max(0, MIN_AUTH_LOADER_MS - elapsedMs)
      if (remainingMs > 0) {
        await wait(remainingMs)
      }

      setInitialising(false)
      setInitialSessionResolved(true)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const login = useCallback(async ({ email, password }) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    const payload = await readResponsePayload(response)

    if (!response.ok || !payload?.user) {
      throw new Error(getErrorMessage(payload, 'Login failed.'))
    }

    setUser(payload.user)
    return payload.user
  }, [])

  const register = useCallback(async (registrationData) => {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationData)
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error('Registration failed.')
    }

    return payload?.user || null
  }, [])

  const requestVerificationCode = useCallback(async ({ email }) => {
    const response = await fetch('/api/v1/auth/request-verification-code', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Unable to send verification code.'))
    }

    return payload || null
  }, [])

  const verifyRegistrationCode = useCallback(async ({ email, code }) => {
    const response = await fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Unable to verify email.'))
    }

    return payload || null
  }, [])

  const requestPasswordReset = useCallback(async ({ email }) => {
    const response = await fetch('/api/v1/auth/request-password-reset', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Unable to request a password reset.'))
    }

    return payload || null
  }, [])

  const resetPassword = useCallback(async ({ token, password }) => {
    const response = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, password })
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Unable to reset password.'))
    }

    return payload || null
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initialising,
      initialSessionResolved,
      refreshSession,
      login,
      register,
      requestVerificationCode,
      verifyRegistrationCode,
      requestPasswordReset,
      resetPassword,
      logout
    }),
    [
      user,
      initialising,
      initialSessionResolved,
      refreshSession,
      login,
      register,
      requestVerificationCode,
      verifyRegistrationCode,
      requestPasswordReset,
      resetPassword,
      logout
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }

  return context
}
