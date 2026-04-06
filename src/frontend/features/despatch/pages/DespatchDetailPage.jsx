import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ChevronRight, Download, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { deleteDespatch, fetchDespatchDetail } from '../api/despatch-api'
import { fetchInvoiceSummaries } from '@/features/invoice/api/invoice-api'
import './styles/DespatchDetailPage.css'

const INVOICE_STATUS_CLASS = {
  Draft: 'despatch-detail-status-draft',
  Issued: 'despatch-detail-status-issued',
  Paid: 'despatch-detail-status-paid',
  Overdue: 'despatch-detail-status-overdue',
  Cancelled: 'despatch-detail-status-cancelled',
}

function formatCurrencyValue(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '-'
  }

  return amount.toFixed(2)
}

function readDestinationLabel(lineItem) {
  if (Array.isArray(lineItem?.destinationOptions)) {
    const labels = lineItem.destinationOptions
      .map((option) => option?.label || option?.key || '')
      .filter(Boolean)

    if (labels.length > 0) {
      return labels.join(', ')
    }
  }

  return lineItem?.destination || '-'
}

export default function DespatchDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [despatch, setDespatch] = useState(null)
  const [relatedInvoices, setRelatedInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingDespatch, setIsDeletingDespatch] = useState(false)

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Despatch Advice', to: '/despatch' },
    { label: despatch?.displayId ? `Despatch Advice ${despatch.displayId}` : 'Despatch Advice' },
  ]
  const despatchLines = Array.isArray(despatch?.lines) ? despatch.lines : []
  const createInvoicePrompt = '/invoice/create?despatchUuid=' + encodeURIComponent(uuid)

  const loadDespatch = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [payload, invoiceSummaries] = await Promise.all([
        fetchDespatchDetail(uuid),
        fetchInvoiceSummaries().catch(() => []),
      ])

      setDespatch(payload)
      setRelatedInvoices(
        Array.isArray(invoiceSummaries)
          ? invoiceSummaries.filter((invoiceDoc) => invoiceDoc?.despatchUuid === uuid)
          : []
      )
    } catch (loadError) {
      setDespatch(null)
      setRelatedInvoices([])
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

  function handleDownloadXml() {
    if (!despatch?.xml) {
      return
    }

    const fileBaseName = despatch.displayId || uuid || 'despatch-advice'
    const safeFileBaseName = String(fileBaseName).replace(/[^a-zA-Z0-9_-]+/g, '-')
    const blob = new Blob([despatch.xml], { type: 'application/xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${safeFileBaseName}.xml`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
  }

  async function handleDeleteDespatch() {
    if (!uuid || isDeletingDespatch) {
      return
    }

    setIsDeletingDespatch(true)
    setError('')

    try {
      await deleteDespatch(uuid)
      setIsDeleteDialogOpen(false)
      navigate('/despatch', { replace: true })
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete despatch detail.')
      setIsDeleteDialogOpen(false)
    } finally {
      setIsDeletingDespatch(false)
    }
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="despatch-detail-download-btn"
              onClick={handleDownloadXml}
              disabled={loading || !despatch?.xml}
            >
              Download XML
              <Download className="size-4" aria-hidden="true" />
            </Button>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="despatch-detail-delete-btn"
                  disabled={loading || isDeletingDespatch || !despatch}
                >
                  Delete Despatch
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="despatch-detail-delete-dialog-content">
                <div className="despatch-detail-delete-dialog-panel">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this despatch advice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes despatch advice {despatch?.displayId || uuid} and all associated invoices, and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingDespatch}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="despatch-detail-delete-confirm-btn"
                      onClick={handleDeleteDespatch}
                      disabled={isDeletingDespatch}
                    >
                      {isDeletingDespatch ? 'Deleting...' : 'Delete Despatch'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </div>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild variant="secondary" size="sm" className="despatch-detail-create-btn">
              <Link to={createInvoicePrompt}>
                Create Invoice
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="despatch-detail-back-btn">
              <Link to="/despatch">Back to despatch advice</Link>
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
                  <dd>
                    <Link className="despatch-detail-copy-link" to={`/despatch/${despatch.uuid}`} title={despatch.uuid}>
                      <span>{despatch.displayId}</span>
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="despatch-detail-status-badge">{despatch.status}</span>
                  </dd>
                </div>
                <div>
                  <dt>Issue Date</dt>
                  <dd>{despatch.issueDate}</dd>
                </div>
                <div>
                  <dt>Order Reference</dt>
                  <dd>
                    {despatch.orderUuid ? (
                      <Link className="despatch-detail-copy-link" to={`/order/${despatch.orderUuid}`} title={despatch.orderUuid}>
                        <span>{despatch.orderDisplayId || '-'}</span>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt># Fulfilment Lines</dt>
                  <dd>{Number(despatch.lineItems) || despatchLines.length || 0}</dd>
                </div>
              </dl>

              <h2 className="despatch-detail-section-title">Fulfilment Lines</h2>
              <div className="despatch-detail-lines-table-wrap">
                {despatchLines.length > 0 ? (
                  <table className="despatch-detail-lines-table despatch-detail-order-lines-table" aria-label="Despatch fulfilment lines">
                    <thead>
                      <tr>
                        <th>Line ID</th>
                        <th>Order Line</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Destination</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despatchLines.map((lineItem, index) => {
                        const quantity = Number(lineItem?.quantity)

                        return (
                          <tr key={`${lineItem?.lineId || 'line'}-${index}`}>
                            <td className="despatch-detail-line-id-cell">
                              <span className="despatch-detail-line-id-badge">{lineItem?.lineId || `LINE-${index + 1}`}</span>
                            </td>
                            <td>{lineItem?.orderLineId || '-'}</td>
                            <td>{lineItem?.itemName || '-'}</td>
                            <td className="despatch-detail-line-center-cell">
                              {Number.isFinite(quantity)
                                ? quantity
                                : '-'}
                            </td>
                            <td>{readDestinationLabel(lineItem)}</td>
                            <td>{lineItem?.description || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="despatch-detail-empty-lines">No fulfilment lines available for this despatch advice.</div>
                )}
              </div>

              <h2 className="despatch-detail-section-title">Related Invoice Documents</h2>
              <div className="despatch-detail-lines-table-wrap">
                {relatedInvoices.length > 0 ? (
                  <table className="despatch-detail-lines-table despatch-detail-invoice-lines-table" aria-label="Related invoices for this despatch advice">
                    <thead>
                      <tr>
                        <th>Invoice ID</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Date</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedInvoices.map((invoiceDoc, index) => (
                        <tr key={invoiceDoc?.uuid || `invoice-${index}`}>
                          <td className="despatch-detail-line-id-cell">
                            <span className="despatch-detail-line-id-badge">{invoiceDoc?.displayId || '-'}</span>
                          </td>
                          <td>
                            <span className={`despatch-detail-status-badge ${INVOICE_STATUS_CLASS[invoiceDoc?.status] ?? ''}`}>
                              {invoiceDoc?.status || '-'}
                            </span>
                          </td>
                          <td className="despatch-detail-line-center-cell">{formatCurrencyValue(invoiceDoc?.total)}</td>
                          <td>{invoiceDoc?.issueDate || '-'}</td>
                          <td>
                            {invoiceDoc?.uuid ? <Link className="despatch-detail-copy-link" to={`/invoice/${invoiceDoc.uuid}`}><span>View</span></Link> : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="despatch-detail-empty-state">
                    <p className="despatch-detail-empty-text">No invoices found yet.</p>
                    <p className="despatch-detail-empty-subtitle">
                      Create one to get started:
                      <Link className="despatch-detail-empty-link" to={createInvoicePrompt}>
                        <span>Create Invoice</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </p>
                  </div>
                )}
              </div>

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
