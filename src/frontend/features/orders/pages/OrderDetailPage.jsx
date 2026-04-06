import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchOrderDetail } from '../api/orders-api'
import './styles/OrderDetailPage.css'

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Orders', to: '/order' },
    { label: order?.displayId ? `Order ${order.displayId}` : 'Order' },
  ]

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await fetchOrderDetail(uuid)
      setOrder(payload)
    } catch (loadError) {
      setOrder(null)
      setError(loadError.message || 'Unable to load order detail.')
    } finally {
      setLoading(false)
    }
  }, [uuid])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen order-detail-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content order-detail-content">
        <header className="order-detail-header">
          <div>
            <h1 className="order-detail-title">Order Detail</h1>
            <p className="order-detail-subtitle">UUID: {uuid}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/order">Back to orders</Link>
          </Button>
        </header>

        <section className="order-detail-card">
          {loading ? <PurpleBarLoader statusLabel="Loading order detail" maxWidth="280px" /> : null}
          {!loading && error ? (
            <div className="order-detail-feedback">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadOrder}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && order ? (
            <>
              <dl className="order-detail-grid">
                <div>
                  <dt>Order ID</dt>
                  <dd>{order.displayId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{order.status}</dd>
                </div>
                <div>
                  <dt>Issue Date</dt>
                  <dd>{order.issueDate}</dd>
                </div>
                <div>
                  <dt>Buyer</dt>
                  <dd>{order.buyer}</dd>
                </div>
                <div>
                  <dt>Supplier</dt>
                  <dd>{order.supplier}</dd>
                </div>
                <div>
                  <dt>Line Items</dt>
                  <dd>{order.lineItems}</dd>
                </div>
              </dl>

              <h2 className="order-detail-section-title">Raw XML</h2>
              <pre className="order-detail-xml">{order.xml}</pre>
            </>
          ) : null}
        </section>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
