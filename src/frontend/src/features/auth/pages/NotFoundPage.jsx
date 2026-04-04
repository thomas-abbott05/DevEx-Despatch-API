import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="not-found-screen">
      <section className="not-found-card">
        <h1>404</h1>
        <p>The page you requested could not be found.</p>
        <Link to="/">Go to home</Link>
      </section>
    </main>
  )
}
