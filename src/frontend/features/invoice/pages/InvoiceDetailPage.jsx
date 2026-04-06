import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Info, Trash2 } from 'lucide-react'
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
import { deleteInvoice, fetchInvoiceDetail, updateInvoiceStatus } from '../api/invoice-api'
import { fetchDespatchDetail } from '@/features/despatch/api/despatch-api'
import './styles/InvoiceDetailPage.css'

const INVOICE_STATUS_CLASS = {
  Issued: 'invoice-detail-status-issued',
  Paid: 'invoice-detail-status-paid',
  Overdue: 'invoice-detail-status-overdue',
}

const DESPATCH_STATUS_CLASS = {
  Pending: 'invoice-detail-despatch-status-pending',
  Shipped: 'invoice-detail-despatch-status-shipped',
  'In Transit': 'invoice-detail-despatch-status-transit',
  Delivered: 'invoice-detail-despatch-status-delivered',
  Cancelled: 'invoice-detail-despatch-status-cancelled',
}

const STATUS_OPTIONS = ['Issued', 'Overdue', 'Paid']

function normaliseInvoiceStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'paid') {
    return 'Paid'
  }
  if (status === 'overdue') {
    return 'Overdue'
  }

  return 'Issued'
}

function formatCurrencyValue(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '-'
  }

  return amount.toFixed(2)
}

function buildStatusDescription(status) {
  if (status === 'Paid') {
    return 'Payment received and reconciled.'
  }
  if (status === 'Overdue') {
    return 'Payment has not been recorded by the due date.'
  }
  return 'Invoice has been issued and is awaiting payment.'
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)
  const [isUpdatingInvoiceStatus, setIsUpdatingInvoiceStatus] = useState(false)
  const status = normaliseInvoiceStatus(invoice?.status)
  const statusDescription = buildStatusDescription(status)
  const sourceLabel = invoice?.despatchUuid ? 'Despatch Advice' : 'Whole Order'
  const linkedOrderUuid = invoice?.orderUuid || relatedDespatch?.orderUuid || ''
  const linkedOrderDisplayId =
    invoice?.orderDisplayId ||
    relatedDespatch?.orderDisplayId ||
    linkedOrderUuid

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

  async function handleStatusChange(nextStatus) {
    const normalizedStatus = normaliseInvoiceStatus(nextStatus)

    if (!uuid || !invoice || isUpdatingInvoiceStatus || normalizedStatus === status) {
      return
    }

    const previousInvoice = invoice

    setError('')
    setIsUpdatingInvoiceStatus(true)
    setInvoice((currentInvoice) =>
      currentInvoice
        ? {
            ...currentInvoice,
            status: normalizedStatus,
          }
        : currentInvoice
    )

    try {
      const updatedInvoice = await updateInvoiceStatus(uuid, normalizedStatus)
      const updatedStatus = normaliseInvoiceStatus(updatedInvoice?.status || normalizedStatus)

      setInvoice((currentInvoice) =>
        currentInvoice
          ? {
              ...currentInvoice,
              ...(updatedInvoice || {}),
              status: updatedStatus,
            }
          : currentInvoice
      )
    } catch (updateError) {
      setInvoice(previousInvoice)
      setError(updateError.message || 'Unable to update invoice status.')
    } finally {
      setIsUpdatingInvoiceStatus(false)
    }
  }

  async function handleDeleteInvoice() {
    if (!uuid || isDeletingInvoice) {
      return
    }

    setIsDeletingInvoice(true)
    setError('')

    try {
      await deleteInvoice(uuid)
      setIsDeleteDialogOpen(false)
      navigate('/invoice', { replace: true })
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete invoice detail.')
      setIsDeleteDialogOpen(false)
    } finally {
      setIsDeletingInvoice(false)
    }
  }

  return (
    <main className="home-screen invoice-detail-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content invoice-detail-content">
        <header className="invoice-detail-header">
          <div>
            <h1 className="invoice-detail-title">Invoice Details</h1>
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
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="invoice-detail-delete-btn"
                  disabled={loading || isDeletingInvoice || !invoice}
                >
                  Delete Invoice
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="invoice-detail-delete-dialog-content">
                <div className="invoice-detail-delete-dialog-panel">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes invoice {invoice?.displayId || uuid} and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingInvoice}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="invoice-detail-delete-confirm-btn"
                      onClick={handleDeleteInvoice}
                      disabled={isDeletingInvoice}
                    >
                      {isDeletingInvoice ? 'Deleting...' : 'Delete Invoice'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </div>
              </AlertDialogContent>
            </AlertDialog>
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
              <section className="invoice-detail-hero" aria-label="Invoice status summary">
                <div>
                  <p className="invoice-detail-hero-label">Current State</p>
                  <div className="invoice-detail-hero-status-row">
                    <span className={`invoice-detail-status-badge ${INVOICE_STATUS_CLASS[status] ?? ''}`}>
                      {status}
                    </span>
                    <span className="invoice-detail-hero-id" title={invoice.displayId || uuid}>{invoice.displayId || uuid}</span>
                  </div>
                  <p className="invoice-detail-hero-text">{statusDescription}</p>
                </div>
                <div className="invoice-detail-hero-meta">
                  <div>
                    <span>Issue Date</span>
                    <strong>{invoice.issueDate || '-'}</strong>
                  </div>
                  <div>
                    <span>Due Date</span>
                    <strong>{invoice.dueDate || '-'}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{sourceLabel}</strong>
                  </div>
                  <div>
                    <label htmlFor="invoice-detail-status-select">Status</label>
                    <select
                      id="invoice-detail-status-select"
                      className="invoice-detail-status-select"
                      value={status}
                      onChange={(event) => handleStatusChange(event.target.value)}
                      disabled={loading || isUpdatingInvoiceStatus || !invoice}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <dl className="invoice-detail-grid">
                <div>
                  <dt>Invoice ID</dt>
                  <dd className="invoice-detail-id-value" title={invoice.displayId || '-'}>{invoice.displayId || '-'}</dd>
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
                  <dt>Source</dt>
                  <dd>{sourceLabel}</dd>
                </div>
                <div>
                  <dt>Issue Date</dt>
                  <dd>{invoice.issueDate || '-'}</dd>
                </div>
                <div>
                  <dt>Due Date</dt>
                  <dd>{invoice.dueDate || '-'}</dd>
                </div>
                <div>
                  <dt>Linked Order</dt>
                  <dd>
                    {linkedOrderUuid ? (
                      <Link className="invoice-detail-copy-link" to={`/order/${linkedOrderUuid}`}>
                        <span>{linkedOrderDisplayId}</span>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Linked Despatch</dt>
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
                    {invoice?.despatchUuid ? (
                      <p className="invoice-detail-empty-text">
                        {relatedDespatchError || 'Linked despatch advice details are currently unavailable.'}
                      </p>
                    ) : (
                      <p className="invoice-detail-empty-text invoice-detail-empty-info">
                        <Info className="size-4 invoice-detail-empty-info-icon" aria-hidden="true" />
                        <span>This invoice pays for the whole order.</span>
                      </p>
                    )}
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
