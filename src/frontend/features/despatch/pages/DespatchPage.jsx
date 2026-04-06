import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Truck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchDespatchSummaries } from '../api/despatch-api'
import './styles/DespatchPage.css'

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
  const [despatches, setDespatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Despatch Advice' },
  ]

  const loadDespatches = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const summaries = await fetchDespatchSummaries()
      setDespatches(summaries)
    } catch (loadError) {
      setDespatches([])
      setError(loadError.message || 'Unable to load despatch documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDespatches()
  }, [loadDespatches])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen despatch-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

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
          {loading ? (
            <div className="despatch-empty">
              <PurpleBarLoader statusLabel="Loading despatch documents" maxWidth="280px" />
            </div>
          ) : error ? (
            <div className="despatch-empty">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadDespatches}>Retry</Button>
            </div>
          ) : despatches.length === 0 ? (
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
                  <th>Status</th>
                  <th>Fulfilment Lines</th>
                  <th>Date created</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {despatches.map((d) => (
                  <tr key={d.uuid}>
                    <td className="despatch-id-cell">
                      <Link to={`/despatch/${d.uuid}`} className="despatch-id-link" title={d.uuid}>
                        <span className="despatch-id-badge">{d.displayId}</span>
                      </Link>
                    </td>
                    <td className="despatch-ref-cell">
                      {d.orderUuid ? (
                        <Link to={`/order/${d.orderUuid}`} className="despatch-order-link" title={d.orderUuid}>
                          {d.orderDisplayId || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`despatch-status-badge ${STATUS_CLASS[d.status] ?? ''}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="despatch-line-items-cell">{Number(d.lineItems) || 0}</td>
                    <td className="despatch-date-cell">{d.issueDate}</td>
                    <td className="despatch-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link className="despatch-view-link" to={`/despatch/${d.uuid}`}>View</Link>
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
