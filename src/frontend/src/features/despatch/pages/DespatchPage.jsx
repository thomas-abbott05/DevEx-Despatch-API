import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Plus, Upload, Truck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/DespatchPage.css'

const mockDespatches = [
  { id: 'DSP-001', orderId: 'ORD-001', carrier: 'FedEx', trackingNo: 'FX-10293847', status: 'Shipped', date: '2026-04-06' },
  { id: 'DSP-002', orderId: 'ORD-002', carrier: 'DHL', trackingNo: 'DH-29384756', status: 'In Transit', date: '2026-04-05' },
  { id: 'DSP-003', orderId: 'ORD-003', carrier: 'UPS', trackingNo: 'UP-38475612', status: 'Delivered', date: '2026-04-04' },
  { id: 'DSP-004', orderId: 'ORD-004', carrier: 'StarTrack', trackingNo: 'ST-47561293', status: 'Pending', date: '2026-04-03' },
  { id: 'DSP-005', orderId: 'ORD-005', carrier: 'FedEx', trackingNo: 'FX-56129384', status: 'Shipped', date: '2026-04-01' },
]

const STATUS_CLASS = {
  Pending: 'status-pending',
  Shipped: 'status-shipped',
  'In Transit': 'status-transit',
  Delivered: 'status-delivered',
  Cancelled: 'status-cancelled',
}

export default function DespatchPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen despatch-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

      <section className="home-content despatch-content">
        <header className="despatch-header">
          <div className="despatch-heading">
            <h1 className="despatch-title">Despatch Advice</h1>
            <p className="despatch-subtitle">View, create, or upload Despatch Advice XML documents.</p>
          </div>
          <div className="despatch-actions">
            <Button asChild variant="outline" size="sm" className="despatch-action-btn">
              <Link to="/despatch/upload">
                <Upload className="size-4" aria-hidden="true" />
                Upload
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="despatch-action-btn despatch-action-primary">
              <Link to="/despatch/create">
                <Plus className="size-4" aria-hidden="true" />
                Create Despatch
              </Link>
            </Button>
          </div>
        </header>

        <div className="despatch-table-wrap">
          {mockDespatches.length === 0 ? (
            <div className="despatch-empty">
              <Truck className="despatch-empty-icon" aria-hidden="true" />
              <p>No despatch advice yet. Create or upload one to get started.</p>
            </div>
          ) : (
            <table className="despatch-table" aria-label="Despatch advice list">
              <thead>
                <tr>
                  <th>Despatch ID</th>
                  <th>Order Ref</th>
                  <th>Carrier</th>
                  <th>Tracking No.</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {mockDespatches.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="despatch-id-badge">{d.id}</span>
                    </td>
                    <td className="despatch-ref-cell">
                      <Link to={`/order/${d.orderId}`} className="despatch-order-link">{d.orderId}</Link>
                    </td>
                    <td>{d.carrier}</td>
                    <td className="despatch-tracking-cell">{d.trackingNo}</td>
                    <td>
                      <span className={`despatch-status-badge ${STATUS_CLASS[d.status] ?? ''}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="despatch-date-cell">{d.date}</td>
                    <td className="despatch-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/despatch/${d.id}`}>View</Link>
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
