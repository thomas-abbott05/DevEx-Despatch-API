import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import './styles/NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <main className="not-found-screen">
      <Card className="not-found-card">
        <CardHeader>
          <CardTitle>404</CardTitle>
          <CardDescription>The page you requested could not be found. We may have moved it, or perhaps you typed in the URL incorrectly :(</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Go to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
