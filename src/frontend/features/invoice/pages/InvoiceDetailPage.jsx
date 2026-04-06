import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchInvoiceDetail } from '../api/invoice-api'
import './styles/InvoiceDetailPage.css'

export default function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Invoices', to: '/invoice' },
    { label: invoice?.displayId ? `Invoice ${invoice.displayId}` : 'Invoice' },
  ]

  const loadInvoice = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await fetchInvoiceDetail(uuid)
      setInvoice(payload)
    } catch (loadError) {
      setInvoice(null)
      setError(loadError.message || 'Unable to load invoice detail.')
    } finally {
      setLoading(false)
    }
  }, [uuid])

  useEffect(() => {
    loadInvoice()
  }, [loadInvoice])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen invoice-detail-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content invoice-detail-content">
        <header className="invoice-detail-header">
          <div>
            <h1 className="invoice-detail-title">Invoice Detail</h1>
            <p className="invoice-detail-subtitle">UUID: {uuid}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/invoice">Back to invoices</Link>
          </Button>
        </header>

        <section className="invoice-detail-card">
          {loading ? <PurpleBarLoader statusLabel="Loading invoice detail" maxWidth="280px" /> : null}
          {!loading && error ? (
            <div className="invoice-detail-feedback">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadInvoice}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && invoice ? (
            <>
              <dl className="invoice-detail-grid">
                <div>
                  <dt>Invoice ID</dt>
                  <dd>{invoice.displayId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{invoice.status}</dd>
                </div>
                <div>
                  <dt>Issue Date</dt>
                  <dd>{invoice.issueDate}</dd>
                </div>
                <div>
                  <dt>Buyer</dt>
                  <dd>{invoice.buyer}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{invoice.total}</dd>
                </div>
                <div>
                  <dt>Despatch Reference</dt>
                  <dd>
                    <Link to={`/despatch/${invoice.despatchUuid}`}>{invoice.despatchDisplayId}</Link>
                  </dd>
                </div>
              </dl>

              <h2 className="invoice-detail-section-title">Raw XML</h2>
              <pre className="invoice-detail-xml">{invoice.xml}</pre>
            </>
          ) : null}
        </section>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
