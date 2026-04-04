import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen">
      <section className="home-card">
        <h1>Welcome, {user?.firstName} {user?.lastName}</h1>
        <p>Signed in as {user?.email}</p>
        <p>Your dashboard is now available at the root route.</p>

        <div className="home-actions">
          <a href="/api-docs">Open API docs</a>
          <button type="button" onClick={onLogout}>Logout</button>
        </div>
      </section>
    </main>
  )
}
