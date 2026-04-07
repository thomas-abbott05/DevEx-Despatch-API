import { Navigate } from 'react-router-dom'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import { useAuth } from './AuthContext'
import MeshGradientBackground from './components/MeshGradientBackground'
import './pages/styles/AuthShared.css'

export function AuthRouteLoader({ statusLabel = 'Checking your session' }) {
  return (
    <MeshGradientBackground animated={false}>
      <section className="route-loading" aria-live="polite" aria-busy="true">
        <img className="auth-logo route-loading-logo" src="/img/devexlogo2.png" alt="DevEx" />
        <PurpleBarLoader className="route-loading-bar-wrap" statusLabel={statusLabel} maxWidth="320px" />
      </section>
    </MeshGradientBackground>
  )
}

export function PublicOnlyRoute({ children }) {
  const { initialSessionResolved, isAuthenticated } = useAuth()
  if (!initialSessionResolved) {
    return <AuthRouteLoader />
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

export function ProtectedRoute({ children }) {
  const { initialSessionResolved, isAuthenticated } = useAuth()

  if (!initialSessionResolved) {
    return <AuthRouteLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
