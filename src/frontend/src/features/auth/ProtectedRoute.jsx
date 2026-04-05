import { Navigate } from 'react-router-dom'
import { BarLoader } from 'react-spinners'
import { useAuth } from './AuthContext'
import MeshGradientBackground from './components/MeshGradientBackground'

export function AuthRouteLoader({ statusLabel = 'Checking your session' }) {
  return (
    <MeshGradientBackground>
      <section className="route-loading" aria-live="polite" aria-busy="true">
        <img className="auth-logo route-loading-logo" src="/img/devexlogo2.png" alt="DevEx" />
        <div className="route-loading-bar-wrap" role="status" aria-label={statusLabel}>
          <BarLoader color="#3f3593" width="100%" height={5} speedMultiplier={2} />
        </div>
      </section>
    </MeshGradientBackground>
  )
}

export function PublicOnlyRoute({ children }) {
  const { initialising, isAuthenticated } = useAuth()
  if (initialising) {
    return <AuthRouteLoader />
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

export function ProtectedRoute({ children }) {
  const { initialising, isAuthenticated } = useAuth()

  if (initialising) {
    return <AuthRouteLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
