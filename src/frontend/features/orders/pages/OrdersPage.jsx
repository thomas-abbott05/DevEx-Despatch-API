import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Upload, FileText } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchOrderSummaries } from '../api/orders-api'
import './styles/OrdersPage.css'

const STATUS_CLASS = {
  Pending: 'status-pending',
  Confirmed: 'status-confirmed',
  'In Transit': 'status-transit',
  Delivered: 'status-delivered',
  Cancelled: 'status-cancelled',
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Orders' },
  ]

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const summaries = await fetchOrderSummaries()
      setOrders(summaries)
    } catch (loadError) {
      setOrders([])
      setError(loadError.message || 'Unable to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen orders-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content orders-content">
        <header className="orders-header">
          <div className="orders-heading">
            <h1 className="orders-title">Orders</h1>
            <p className="orders-subtitle">View, create, or upload Order XML documents.</p>
          </div>
          <div className="orders-actions">
            <Button asChild variant="outline" size="sm" className="orders-action-btn">
              <Link to="/order/upload">
                <Upload className="size-4" aria-hidden="true" />
                Upload
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="orders-action-btn orders-action-primary">
              <Link to="/order/create">
                <Plus className="size-4" aria-hidden="true" />
                Create Order
              </Link>
            </Button>
          </div>
        </header>

        <div className="orders-table-wrap">
          {loading ? (
            <div className="orders-empty">
              <PurpleBarLoader statusLabel="Loading orders" maxWidth="280px" />
            </div>
          ) : error ? (
            <div className="orders-empty">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadOrders}>Retry</Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="orders-empty">
              <FileText className="orders-empty-icon" aria-hidden="true" />
              <p>No orders yet. Create or upload one to get started.</p>
            </div>
          ) : (
            <table className="orders-table" aria-label="Orders list">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Buyer</th>
                  <th>Supplier</th>
                  <th>Line Items</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.uuid}>
                    <td className="orders-id-cell">
                      <span className="orders-id-badge">{order.displayId}</span>
                    </td>
                    <td>{order.buyer}</td>
                    <td>{order.supplier}</td>
                    <td className="orders-center-cell">{order.lineItems}</td>
                    <td>
                      <span className={`orders-status-badge ${STATUS_CLASS[order.status] ?? ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="orders-date-cell">{order.issueDate}</td>
                    <td className="orders-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link className="orders-view-link auth-footer-link" to={`/order/${order.uuid}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
