import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchDespatchDetail } from '../api/despatch-api'
import './styles/DespatchDetailPage.css'

export default function DespatchDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [despatch, setDespatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Despatch Advice', to: '/despatch' },
    { label: despatch?.displayId ? `Despatch Advice ${despatch.displayId}` : 'Despatch Advice' },
  ]

  const loadDespatch = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await fetchDespatchDetail(uuid)
      setDespatch(payload)
    } catch (loadError) {
      setDespatch(null)
      setError(loadError.message || 'Unable to load despatch detail.')
    } finally {
      setLoading(false)
    }
  }, [uuid])

  useEffect(() => {
    loadDespatch()
  }, [loadDespatch])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen despatch-detail-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content despatch-detail-content">
        <header className="despatch-detail-header">
          <div>
            <h1 className="despatch-detail-title">Despatch Advice Detail</h1>
            <p className="despatch-detail-subtitle">UUID: {uuid}</p>
          </div>
          <div className="despatch-detail-actions">
            <Button asChild variant="secondary" size="sm" className="despatch-detail-create-btn">
              <Link to={`/invoice/create?despatchUuid=${encodeURIComponent(uuid)}`}>
                Create Invoice
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/despatch">Back to view all</Link>
            </Button>
          </div>
        </header>

        <section className="despatch-detail-card">
          {loading ? <PurpleBarLoader statusLabel="Loading despatch detail" maxWidth="280px" /> : null}
          {!loading && error ? (
            <div className="despatch-detail-feedback">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadDespatch}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && despatch ? (
            <>
              <dl className="despatch-detail-grid">
                <div>
                  <dt>Despatch ID</dt>
                  <dd>{despatch.displayId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{despatch.status}</dd>
                </div>
                <div>
                  <dt>Issue Date</dt>
                  <dd>{despatch.issueDate}</dd>
                </div>
                <div>
                  <dt>Carrier</dt>
                  <dd>{despatch.carrier}</dd>
                </div>
                <div>
                  <dt>Tracking</dt>
                  <dd>{despatch.trackingNo}</dd>
                </div>
                <div>
                  <dt>Order Reference</dt>
                  <dd>
                    <Link to={`/order/${despatch.orderUuid}`}>{despatch.orderDisplayId}</Link>
                  </dd>
                </div>
              </dl>

              <h2 className="despatch-detail-section-title">Raw XML</h2>
              <pre className="despatch-detail-xml">{despatch.xml}</pre>
            </>
          ) : null}
        </section>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
