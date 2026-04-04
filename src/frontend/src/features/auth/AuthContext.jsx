import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

async function readResponsePayload(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getErrorMessage(payload, fallbackMessage) {
  if (payload?.errors?.length) {
    return payload.errors.join(' ')
  }

  return fallbackMessage
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initialising, setInitialising] = useState(true)

  const refreshSession = useCallback(async () => {
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
      setInitialising(false)
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
      throw new Error(getErrorMessage(payload, 'Registration failed.'))
    }

    return payload?.user || null
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
      refreshSession,
      login,
      register,
      logout
    }),
    [user, initialising, refreshSession, login, register, logout]
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
