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
import { deleteOrder, fetchOrderDetail } from '../api/orders-api'
import './styles/OrderDetailPage.css'

const ORDER_STATUS_CLASS = {
  Pending: 'order-detail-order-status-pending',
  'In Progress': 'order-detail-order-status-in-progress',
  Despatched: 'order-detail-order-status-despatched',
  Completed: 'order-detail-order-status-completed',
}

const DESPATCH_STATUS_CLASS = {
  Pending: 'order-detail-status-pending',
  Shipped: 'order-detail-status-shipped',
  Received: 'order-detail-status-received',
  'In Transit': 'order-detail-status-transit',
  Delivered: 'order-detail-status-delivered',
  Cancelled: 'order-detail-status-cancelled',
}

const INVOICE_STATUS_CLASS = {
  Issued: 'order-detail-invoice-status-issued',
  Paid: 'order-detail-invoice-status-paid',
  Overdue: 'order-detail-invoice-status-overdue',
}

const PAYMENT_STATUS_CLASS = {
  Paid: 'order-detail-payment-status-paid',
  'Partially Paid': 'order-detail-payment-status-partial',
  'Not Paid': 'order-detail-payment-status-unpaid',
}

function normaliseDespatchStatus(statusValue) {
  const status = String(statusValue || '').trim().toLowerCase()

  if (status === 'received') {
    return 'Received'
  }
  if (status === 'shipped') {
    return 'Shipped'
  }
  if (status === 'pending') {
    return 'Pending'
  }

  return String(statusValue || '').trim() || '-'
}

function normaliseInvoiceStatus(statusValue) {
  const status = String(statusValue || '').trim().toLowerCase()

  if (status === 'paid') {
    return 'Paid'
  }
  if (status === 'overdue') {
    return 'Overdue'
  }
  if (status === 'issued') {
    return 'Issued'
  }

  return 'Issued'
}

function readLineUnitPrice(lineItem) {
  const unitPrice = Number(lineItem?.unitPrice)
  if (Number.isFinite(unitPrice)) {
    return unitPrice
  }

  const nestedUnitPrice = Number(lineItem?.lineItem?.price?.priceAmount)
  if (Number.isFinite(nestedUnitPrice)) {
    return nestedUnitPrice
  }

  return null
}

function formatCurrencyValue(value) {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return value.toFixed(2)
}

function readLineDespatchedQuantity(lineItem) {
  const directDespatchedQuantity = Number(lineItem?.despatchedQuantity)
  if (Number.isFinite(directDespatchedQuantity)) {
    return directDespatchedQuantity
  }

  const shippedQuantity = Number(lineItem?.shippedQuantity)
  if (Number.isFinite(shippedQuantity)) {
    return shippedQuantity
  }

  const fulfilledQuantity = Number(lineItem?.fulfilledQuantity)
  if (Number.isFinite(fulfilledQuantity)) {
    return fulfilledQuantity
  }

  return 0
}

function formatQuantityValue(value) {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function deriveOrderPaymentFallback(invoiceDocuments) {
  const invoices = Array.isArray(invoiceDocuments) ? invoiceDocuments : []
  const invoiceCount = invoices.length
  const paidInvoiceCount = invoices.filter(
    (invoiceDoc) => normaliseInvoiceStatus(invoiceDoc?.status) === 'Paid'
  ).length
  const outstandingInvoiceCount = Math.max(invoiceCount - paidInvoiceCount, 0)

  if (!invoiceCount) {
    return {
      status: 'Not Paid',
      paidInFull: false,
      hasInvoices: false,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount,
    }
  }

  if (!outstandingInvoiceCount) {
    return {
      status: 'Paid',
      paidInFull: true,
      hasInvoices: true,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount,
    }
  }

  if (paidInvoiceCount > 0) {
    return {
      status: 'Partially Paid',
      paidInFull: false,
      hasInvoices: true,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount,
    }
  }

  return {
    status: 'Not Paid',
    paidInFull: false,
    hasInvoices: true,
    invoiceCount,
    paidInvoiceCount,
    outstandingInvoiceCount,
  }
}

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const { uuid = '' } = useParams()
  const { user, logout } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingOrder, setIsDeletingOrder] = useState(false)

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Orders', to: '/order' },
    { label: order?.displayId ? `Order ${order.displayId}` : 'Order' },
  ]
  const lineItems = Array.isArray(order?.orderLines) ? order.orderLines : []
  const despatchAdviceDocuments = Array.isArray(order?.despatchAdvice) ? order.despatchAdvice : []
  const invoiceDocuments = Array.isArray(order?.invoiceDocuments) ? order.invoiceDocuments : []
  const paymentSummary = order?.payment && typeof order.payment === 'object'
    ? order.payment
    : deriveOrderPaymentFallback(invoiceDocuments)
  const pendingDespatchLines = Array.isArray(order?.pendingDespatchLines)
    ? order.pendingDespatchLines
    : lineItems
        .map((lineItem, index) => {
          const requestedQuantity = Number(lineItem?.requestedQuantity)
          const quantityDespatched = readLineDespatchedQuantity(lineItem)
          const quantityPending = Number.isFinite(requestedQuantity)
            ? Math.max(requestedQuantity - quantityDespatched, 0)
            : NaN
          const destinationLabels = Array.isArray(lineItem?.destinationOptions)
            ? lineItem.destinationOptions
                .map((option) => option?.label || option?.key)
                .filter(Boolean)
            : []

          return {
            lineId: lineItem?.lineId || `LINE-${index + 1}`,
            quantityOrdered: requestedQuantity,
            quantityPending,
            quantityDespatched,
            destination: destinationLabels.length > 0 ? destinationLabels.join(', ') : '-',
          }
        })
        .filter((lineItem) => Number.isFinite(lineItem.quantityPending) && lineItem.quantityPending > 0)
  const pendingDespatchCount = pendingDespatchLines.length
  const despatchAdviceEmptyPrompt = '/despatch/create?orderUuid=' + encodeURIComponent(uuid)
  const invoiceDocumentsEmptyPrompt = '/invoice/create?orderUuid=' + encodeURIComponent(uuid)
  const orderTotal = lineItems.reduce((sum, lineItem) => {
    const quantity = Number(lineItem?.requestedQuantity)
    const unitPrice = readLineUnitPrice(lineItem)

    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      return sum
    }

    return sum + quantity * unitPrice
  }, 0)

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

  function handleDownloadXml() {
    if (!order?.xml) {
      return
    }

    const fileBaseName = order.displayId || uuid || 'order'
    const safeFileBaseName = String(fileBaseName).replace(/[^a-zA-Z0-9_-]+/g, '-')
    const blob = new Blob([order.xml], { type: 'application/xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${safeFileBaseName}.xml`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
  }

  async function handleDeleteOrder() {
    if (!uuid || isDeletingOrder) {
      return
    }

    setIsDeletingOrder(true)
    setError('')

    try {
      await deleteOrder(uuid)
      setIsDeleteDialogOpen(false)
      navigate('/order', { replace: true })
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete order detail.')
      setIsDeleteDialogOpen(false)
    } finally {
      setIsDeletingOrder(false)
    }
  }

  return (
    <main className="home-screen order-detail-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content order-detail-content">
        <header className="order-detail-header">
          <div>
            <h1 className="order-detail-title">Order Details</h1>
            <p className="order-detail-subtitle">UUID: {uuid}</p>
          </div>
          <div className="order-detail-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="order-detail-download-btn"
              onClick={handleDownloadXml}
              disabled={loading || !order?.xml}
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
                  className="order-detail-delete-btn"
                  disabled={loading || isDeletingOrder || !order}
                >
                  Delete Order
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="order-detail-delete-dialog-content">
                <div className="order-detail-delete-dialog-panel">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes order {order?.displayId || uuid} and all associated Despatch Advice documents, and cannot be undone. You may want to use an Order Cancellation instead to mark it as cancelled and create a Cancellation XML document.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingOrder}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="order-detail-delete-confirm-btn"
                      onClick={handleDeleteOrder}
                      disabled={isDeletingOrder}
                    >
                      {isDeletingOrder ? 'Deleting...' : 'Delete Order'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </div>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild variant="secondary" size="sm" className="order-detail-create-btn">
              <Link to={`/despatch/create?orderUuid=${encodeURIComponent(uuid)}`}>
                Create Despatch Advice
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="order-detail-create-btn">
              <Link to={`/invoice/create?orderUuid=${encodeURIComponent(uuid)}`}>
                Create Invoice
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="order-detail-back-btn">
              <Link to="/order">Back to orders</Link>
            </Button>
          </div>
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
                  <dd>
                    <Link className="order-detail-copy-link" to={`/order/${order.uuid}`} title={order.uuid}>
                      <span>{order.displayId}</span>
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`order-detail-status-badge order-detail-order-status-badge ${ORDER_STATUS_CLASS[order.status] ?? ''}`}>
                      {order.status || '-'}
                    </span>
                  </dd>
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
                  <dt># Line Items</dt>
                  <dd>{order.lineItems}</dd>
                </div>
              </dl>

              <h2 className="order-detail-section-title">Line Items</h2>
              <div className="order-detail-lines-table-wrap">
                {lineItems.length > 0 ? (
                  <table className="order-detail-lines-table order-detail-order-lines-table" aria-label="Order line items">
                    <thead>
                      <tr>
                        <th>Line ID</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Shipped</th>
                        <th>Unit Price</th>
                        <th>Description</th>
                        <th>Destination</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((lineItem, index) => {
                        const quantity = Number(lineItem?.requestedQuantity)
                        const despatchedQuantity = readLineDespatchedQuantity(lineItem)
                        const unitPrice = readLineUnitPrice(lineItem)
                        const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice)
                          ? quantity * unitPrice
                          : null
                        const destinationLabels = Array.isArray(lineItem?.destinationOptions)
                          ? lineItem.destinationOptions
                              .map((option) => option?.label || option?.key || 'Destination')
                              .filter(Boolean)
                          : []

                        return (
                          <tr key={`${lineItem?.lineId || 'line'}-${index}`}>
                            <td className="order-detail-line-id-cell">
                              <span className="order-detail-line-id-badge">{lineItem?.lineId || `LINE-${index + 1}`}</span>
                            </td>
                            <td>{lineItem?.itemName || '-'}</td>
                            <td className="order-detail-line-center-cell">
                              {formatQuantityValue(quantity)}
                            </td>
                            <td className="order-detail-line-center-cell">{formatQuantityValue(despatchedQuantity)}</td>
                            <td className="order-detail-line-center-cell">{formatCurrencyValue(unitPrice)}</td>
                            <td>{lineItem?.description || '-'}</td>
                            <td>
                              {destinationLabels.length > 0 ? destinationLabels.join(', ') : '-'}
                            </td>
                            <td className="order-detail-line-center-cell">{formatCurrencyValue(lineTotal)}</td>
                          </tr>
                        )
                      })}
                      <tr className="order-detail-total-row">
                        <td colSpan={7}>Order Total</td>
                        <td className="order-detail-line-center-cell">{formatCurrencyValue(orderTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="order-detail-empty-lines">No line items available for this order.</div>
                )}
              </div>

              {pendingDespatchCount > 0 ? (
                <div className="order-detail-warning-wrap" role="status" aria-live="polite">
                  <p className="order-detail-warning-title">{pendingDespatchCount} item lines are pending full despatch:</p>
                  <div className="order-detail-lines-table-wrap order-detail-warning-table-wrap">
                    <table className="order-detail-lines-table order-detail-warning-table" aria-label="Order lines pending full despatch">
                      <thead>
                        <tr>
                          <th>Line ID</th>
                          <th>Quantity Ordered</th>
                          <th>Quantity Despatched</th>
                          <th>Quantity Pending Despatch</th>
                          <th>Destination</th>
                          <th><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingDespatchLines.map((lineItem, index) => (
                          <tr key={`${lineItem?.lineId || 'pending-line'}-${index}`}>
                            <td className="order-detail-line-id-cell">
                              <span className="order-detail-line-id-badge">{lineItem?.lineId || `LINE-${index + 1}`}</span>
                            </td>
                            <td className="order-detail-line-center-cell">
                              {formatQuantityValue(Number(lineItem?.quantityOrdered ?? (Number(lineItem?.quantityPending) + Number(lineItem?.quantityDespatched))))}
                            </td>
                            <td className="order-detail-line-center-cell">{formatQuantityValue(Number(lineItem?.quantityDespatched))}</td>
                            <td className="order-detail-line-center-cell">{formatQuantityValue(Number(lineItem?.quantityPending))}</td>
                            <td>{lineItem?.destination || '-'}</td>
                            <td className="order-detail-warning-action-cell">
                              <Button asChild variant="secondary" size="sm" className="order-detail-create-btn order-detail-warning-action-btn">
                                <Link to={`/despatch/create?orderUuid=${encodeURIComponent(uuid)}`}>
                                  Create Despatch Advice
                                  <ChevronRight className="size-4" aria-hidden="true" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <h2 className="order-detail-section-title">Despatch Advice Documents</h2>
              <div className="order-detail-lines-table-wrap">
                {despatchAdviceDocuments.length > 0 ? (
                  <table className="order-detail-lines-table order-detail-despatch-lines-table" aria-label="Despatch advice documents for this order">
                    <thead>
                      <tr>
                        <th>Despatch ID</th>
                        <th>Status</th>
                        <th>Fulfilment Lines</th>
                        <th>Destination</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {despatchAdviceDocuments.map((despatchDoc, index) => (
                        <tr key={despatchDoc?.uuid || `despatch-${index}`}>
                          <td className="order-detail-line-id-cell">
                            <span className="order-detail-line-id-badge">{despatchDoc?.displayId || '-'}</span>
                          </td>
                          <td>
                            <span className={`order-detail-status-badge order-detail-despatch-status-badge ${DESPATCH_STATUS_CLASS[normaliseDespatchStatus(despatchDoc?.status)] ?? ''}`}>
                              {normaliseDespatchStatus(despatchDoc?.status)}
                            </span>
                          </td>
                          <td className="order-detail-line-center-cell">{Number(despatchDoc?.lineItems) || 0}</td>
                          <td>{despatchDoc?.destination || '-'}</td>
                          <td>{despatchDoc?.uuid ? <Link to={`/despatch/${despatchDoc.uuid}`}>View</Link> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="order-detail-empty-state">
                    <p className="order-detail-empty-text">No documents found yet.</p>
                    <p className="order-detail-empty-subtitle">
                      Create one to get started:
                      <Link className="order-detail-empty-link" to={despatchAdviceEmptyPrompt}>
                        <span>Create Despatch Advice</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </p>
                  </div>
                )}
              </div>

              <h2 className="order-detail-section-title">Invoice Documents</h2>
              <div className="order-detail-payment-summary" role="status" aria-live="polite">
                <span className={`order-detail-status-badge order-detail-payment-status-badge ${PAYMENT_STATUS_CLASS[paymentSummary?.status] ?? ''}`}>
                  {paymentSummary?.status || 'Not Paid'}
                </span>
                <span className="order-detail-payment-meta">
                  {paymentSummary?.hasInvoices
                    ? `${Number(paymentSummary?.paidInvoiceCount) || 0} of ${Number(paymentSummary?.invoiceCount) || invoiceDocuments.length} invoices paid`
                    : 'No invoices created yet for this order.'}
                </span>
              </div>

              <div className="order-detail-lines-table-wrap">
                {invoiceDocuments.length > 0 ? (
                  <table className="order-detail-lines-table order-detail-invoice-lines-table" aria-label="Invoice documents for this order">
                    <thead>
                      <tr>
                        <th>Invoice ID</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th>Total</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDocuments.map((invoiceDoc, index) => {
                        const invoiceStatus = normaliseInvoiceStatus(invoiceDoc?.status)

                        return (
                          <tr key={invoiceDoc?.uuid || `invoice-${index}`}>
                            <td className="order-detail-line-id-cell">
                              <span className="order-detail-line-id-badge">{invoiceDoc?.displayId || '-'}</span>
                            </td>
                            <td>
                              <span className={`order-detail-status-badge order-detail-invoice-status-badge ${INVOICE_STATUS_CLASS[invoiceStatus] ?? ''}`}>
                                {invoiceStatus}
                              </span>
                            </td>
                            <td>{invoiceDoc?.sourceLabel || '-'}</td>
                            <td className="order-detail-line-center-cell">{invoiceDoc?.issueDate || '-'}</td>
                            <td className="order-detail-line-center-cell">{invoiceDoc?.dueDate || '-'}</td>
                            <td className="order-detail-line-center-cell">{formatCurrencyValue(Number(invoiceDoc?.total))}</td>
                            <td>{invoiceDoc?.uuid ? <Link to={`/invoice/${invoiceDoc.uuid}`}>View</Link> : '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="order-detail-empty-state">
                    <p className="order-detail-empty-text">No invoice documents found yet.</p>
                    <p className="order-detail-empty-subtitle">
                      Create one to get started:
                      <Link className="order-detail-empty-link" to={invoiceDocumentsEmptyPrompt}>
                        <span>Create Invoice</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </p>
                  </div>
                )}
              </div>

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
