import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchInvoiceDetail } from '../api/invoice-api'
import { fetchDespatchDetail } from '@/features/despatch/api/despatch-api'
import './styles/InvoiceDetailPage.css'

const INVOICE_STATUS_CLASS = {
  Draft: 'invoice-detail-status-draft',
  Issued: 'invoice-detail-status-issued',
  Paid: 'invoice-detail-status-paid',
  Overdue: 'invoice-detail-status-overdue',
  Cancelled: 'invoice-detail-status-cancelled',
}

const DESPATCH_STATUS_CLASS = {
  Pending: 'invoice-detail-despatch-status-pending',
  Shipped: 'invoice-detail-despatch-status-shipped',
  'In Transit': 'invoice-detail-despatch-status-transit',
  Delivered: 'invoice-detail-despatch-status-delivered',
  Cancelled: 'invoice-detail-despatch-status-cancelled',
}

function formatCurrencyValue(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '-'
  }

  return amount.toFixed(2)
}

export default function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [relatedDespatch, setRelatedDespatch] = useState(null)
  const [relatedDespatchError, setRelatedDespatchError] = useState('')
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

      if (payload?.despatchUuid) {
        try {
          const linkedDespatch = await fetchDespatchDetail(payload.despatchUuid)
          setRelatedDespatch(linkedDespatch)
          setRelatedDespatchError('')
        } catch (linkedDespatchLoadError) {
          setRelatedDespatch(null)
          setRelatedDespatchError(linkedDespatchLoadError.message || 'Unable to load linked despatch advice detail.')
        }
      } else {
        setRelatedDespatch(null)
        setRelatedDespatchError('')
      }
    } catch (loadError) {
      setInvoice(null)
      setRelatedDespatch(null)
      setRelatedDespatchError('')
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

  function handleDownloadXml() {
    if (!invoice?.xml) {
      return
    }

    const fileBaseName = invoice.displayId || uuid || 'invoice'
    const safeFileBaseName = String(fileBaseName).replace(/[^a-zA-Z0-9_-]+/g, '-')
    const blob = new Blob([invoice.xml], { type: 'application/xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${safeFileBaseName}.xml`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
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
          <div className="invoice-detail-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="invoice-detail-download-btn"
              onClick={handleDownloadXml}
              disabled={loading || !invoice?.xml}
            >
              Download XML
              <Download className="size-4" aria-hidden="true" />
            </Button>
            <Button asChild variant="outline" size="sm" className="invoice-detail-back-btn">
              <Link to="/invoice">Back to invoices</Link>
            </Button>
          </div>
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
                  <dd>
                    <span className={`invoice-detail-status-badge ${INVOICE_STATUS_CLASS[invoice.status] ?? ''}`}>
                      {invoice.status}
                    </span>
                  </dd>
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
                  <dd className="invoice-detail-total-value">{formatCurrencyValue(invoice.total)}</dd>
                </div>
                <div>
                  <dt>Despatch Reference</dt>
                  <dd>
                    {invoice.despatchUuid ? (
                      <Link className="invoice-detail-copy-link" to={`/despatch/${invoice.despatchUuid}`}>
                        <span>{invoice.despatchDisplayId || invoice.despatchUuid}</span>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
              </dl>

              <h2 className="invoice-detail-section-title">Linked Despatch Advice</h2>
              <div className="invoice-detail-lines-table-wrap">
                {relatedDespatch ? (
                  <table className="invoice-detail-lines-table" aria-label="Linked despatch advice">
                    <thead>
                      <tr>
                        <th>Despatch ID</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="invoice-detail-line-id-cell">
                          {relatedDespatch.uuid ? (
                            <Link className="invoice-detail-copy-link" to={`/despatch/${relatedDespatch.uuid}`} title={relatedDespatch.uuid}>
                              <span className="invoice-detail-line-id-badge">{relatedDespatch.displayId || '-'}</span>
                            </Link>
                          ) : (
                            <span className="invoice-detail-line-id-badge">{relatedDespatch.displayId || '-'}</span>
                          )}
                        </td>
                        <td>
                          <span className={`invoice-detail-status-badge ${DESPATCH_STATUS_CLASS[relatedDespatch.status] ?? ''}`}>
                            {relatedDespatch.status || '-'}
                          </span>
                        </td>
                        <td>{relatedDespatch.issueDate || '-'}</td>
                        <td>
                          {relatedDespatch.uuid ? (
                            <Link className="invoice-detail-copy-link" to={`/despatch/${relatedDespatch.uuid}`}>
                              <span>View</span>
                            </Link>
                          ) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="invoice-detail-empty-state">
                    <p className="invoice-detail-empty-text">
                      {invoice?.despatchUuid
                        ? relatedDespatchError || 'Linked despatch advice details are currently unavailable.'
                        : 'No linked despatch advice is available for this invoice.'}
                    </p>
                    {invoice?.despatchUuid ? (
                      <p className="invoice-detail-empty-subtitle">
                        Open linked document:
                        <Link className="invoice-detail-empty-link" to={`/despatch/${invoice.despatchUuid}`}>
                          <span>View Despatch Advice</span>
                        </Link>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

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
