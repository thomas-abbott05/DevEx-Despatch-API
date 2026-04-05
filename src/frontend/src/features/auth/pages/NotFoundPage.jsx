import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import './styles/NotFoundPage.css'
import MeshGradientBackground from '../components/MeshGradientBackground'

export default function NotFoundPage() {
  return (
    <MeshGradientBackground>
      <main className="not-found-screen">
        <Card className="not-found-card">
          <CardHeader>
            <CardTitle className="not-found-title">404</CardTitle>
            <CardDescription className="not-found-description">
              The page you requested could not be found. We may have moved it, or perhaps you typed in the URL incorrectly :(
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="auth-main-action" style={{ marginTop: '2rem', marginBottom: '2rem' }} asChild>
              <Link to="/">Go to home</Link>
            </Button>
            <img className="not-found-image" src="/img/devexlogo2.png" alt="DevEx Logo" />
            <p style={{fontSize: '0.6rem'}}>Copyright (not really..) DevEx SENG team 26T1 😼😼😼</p>
          </CardContent>
        </Card>
      </main>
    </MeshGradientBackground>
  )
}
