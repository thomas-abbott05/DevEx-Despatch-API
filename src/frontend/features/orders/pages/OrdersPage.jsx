import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Upload, FileText } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/OrdersPage.css'

const mockOrders = [
  { id: 'ORD-001', buyer: 'Acme Corp', supplier: 'GlobalSupply Ltd', items: 4, status: 'Pending', date: '2026-04-06' },
  { id: 'ORD-002', buyer: 'Nexus Inc', supplier: 'PartnerCo', items: 2, status: 'Confirmed', date: '2026-04-05' },
  { id: 'ORD-003', buyer: 'Skyline Group', supplier: 'GlobalSupply Ltd', items: 7, status: 'In Transit', date: '2026-04-04' },
  { id: 'ORD-004', buyer: 'Acme Corp', supplier: 'FastShip Pty', items: 1, status: 'Delivered', date: '2026-04-02' },
  { id: 'ORD-005', buyer: 'Meridian LLC', supplier: 'PartnerCo', items: 3, status: 'Pending', date: '2026-04-01' },
]

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
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen orders-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

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
          {mockOrders.length === 0 ? (
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
                  <th>Date</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="orders-id-cell">
                      <span className="orders-id-badge">{order.id}</span>
                    </td>
                    <td>{order.buyer}</td>
                    <td>{order.supplier}</td>
                    <td className="orders-center-cell">{order.items}</td>
                    <td>
                      <span className={`orders-status-badge ${STATUS_CLASS[order.status] ?? ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="orders-date-cell">{order.date}</td>
                    <td className="orders-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/order/${order.id}`}>View</Link>
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
