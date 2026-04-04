import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function NotFoundPage() {
  return (
    <main className="not-found-screen">
      <Card className="not-found-card">
        <CardHeader>
          <CardTitle>404</CardTitle>
          <CardDescription>The page you requested could not be found.</CardDescription>
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
