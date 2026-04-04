import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen">
      <Card className="home-card">
        <CardHeader>
          <CardTitle>Welcome, {user?.firstName} {user?.lastName}</CardTitle>
          <CardDescription>Signed in as {user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Your dashboard is now available at the root route.</p>

          <div className="home-actions">
            <a href="/api-docs">Open API docs</a>
            <Button type="button" onClick={onLogout}>Logout</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
