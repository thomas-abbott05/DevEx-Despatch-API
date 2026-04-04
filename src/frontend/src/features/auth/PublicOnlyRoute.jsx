import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function PublicOnlyRoute({ children }) {
  const { initialising, isAuthenticated } = useAuth()

  if (initialising) {
    return <div className="route-loading">Checking your session...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
