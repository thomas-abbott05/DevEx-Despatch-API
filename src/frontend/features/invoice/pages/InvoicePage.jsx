import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Receipt } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchInvoiceSummaries } from '../api/invoice-api'
import './styles/InvoicePage.css'

const STATUS_CLASS = {
  Draft: 'status-draft',
  Issued: 'status-issued',
  Paid: 'status-paid',
  Overdue: 'status-overdue',
  Cancelled: 'status-cancelled',
}

export default function InvoicePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Invoices' },
  ]

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const summaries = await fetchInvoiceSummaries()
      setInvoices(summaries)
    } catch (loadError) {
      setInvoices([])
      setError(loadError.message || 'Unable to load invoices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen invoice-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content invoice-content">
        <header className="invoice-header">
          <div className="invoice-heading">
            <h1 className="invoice-title">Invoices</h1>
            <p className="invoice-subtitle">View, create, or upload Invoice XML documents.</p>
          </div>
          <div className="invoice-actions">
            <Button asChild variant="outline" size="sm" className="invoice-action-btn">
              <Link to="/invoice/upload">
                <Upload className="size-4" aria-hidden="true" />
                Upload
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="invoice-action-btn invoice-action-primary">
              <Link to="/invoice/create">
                <Plus className="size-4" aria-hidden="true" />
                Create Invoice
              </Link>
            </Button>
          </div>
        </header>

        <div className="invoice-table-wrap">
          {loading ? (
            <div className="invoice-empty">
              <PurpleBarLoader statusLabel="Loading invoices" maxWidth="280px" />
            </div>
          ) : error ? (
            <div className="invoice-empty">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadInvoices}>Retry</Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="invoice-empty">
              <Receipt className="invoice-empty-icon" aria-hidden="true" />
              <p>No invoices yet. Create or upload one to get started.</p>
            </div>
          ) : (
            <table className="invoice-table" aria-label="Invoices list">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Despatch Ref</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.uuid}>
                    <td>
                      <span className="invoice-id-badge">{inv.displayId}</span>
                    </td>
                    <td>
                      <Link to={`/despatch/${inv.despatchUuid}`} className="invoice-ref-link">{inv.despatchDisplayId}</Link>
                    </td>
                    <td>{inv.buyer}</td>
                    <td className="invoice-total-cell">{inv.total}</td>
                    <td>
                      <span className={`invoice-status-badge ${STATUS_CLASS[inv.status] ?? ''}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="invoice-date-cell">{inv.issueDate}</td>
                    <td className="invoice-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/invoice/${inv.uuid}`}>View</Link>
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
