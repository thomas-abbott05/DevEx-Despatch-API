import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Upload, Receipt } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchInvoiceSummaries, updateInvoiceStatus } from '../api/invoice-api'
import './styles/InvoicePage.css'

const STATUS_CLASS = {
  Issued: 'status-issued',
  Paid: 'status-paid',
  Overdue: 'status-overdue',
}

const STATUS_OPTIONS = ['Issued', 'Paid', 'Overdue']
const STATUS_FILTER_OPTIONS = ['All', ...STATUS_OPTIONS]

function normaliseInvoiceStatus(value) {
  const rawValue = String(value || '').trim().toLowerCase()
  if (rawValue === 'paid') {
    return 'Paid'
  }
  if (rawValue === 'overdue') {
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

export default function InvoicePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingInvoiceUuid, setUpdatingInvoiceUuid] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
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

  const filteredInvoices = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    return invoices.filter((invoiceDoc) => {
      const status = normaliseInvoiceStatus(invoiceDoc?.status)
      if (statusFilter !== 'All' && status !== statusFilter) {
        return false
      }

      if (!normalizedTerm) {
        return true
      }

      const haystack = [
        invoiceDoc?.displayId,
        invoiceDoc?.despatchDisplayId,
        invoiceDoc?.buyer,
        invoiceDoc?.issueDate,
        invoiceDoc?.dueDate,
        status,
      ]
        .map((entry) => String(entry || '').toLowerCase())
        .join(' ')

      return haystack.includes(normalizedTerm)
    })
  }, [invoices, searchTerm, statusFilter])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function clearFilters() {
    setSearchTerm('')
    setStatusFilter('All')
  }

  async function handleStatusChange(invoiceUuid, nextStatus) {
    const normalizedStatus = normaliseInvoiceStatus(nextStatus)
    const previousInvoices = invoices

    setError('')
    setUpdatingInvoiceUuid(invoiceUuid)
    setInvoices((currentInvoices) =>
      currentInvoices.map((invoiceDoc) =>
        invoiceDoc.uuid === invoiceUuid
          ? { ...invoiceDoc, status: normalizedStatus }
          : invoiceDoc
      )
    )

    try {
      const updatedInvoice = await updateInvoiceStatus(invoiceUuid, normalizedStatus)
      const updatedStatus = normaliseInvoiceStatus(updatedInvoice?.status)

      setInvoices((currentInvoices) =>
        currentInvoices.map((invoiceDoc) =>
          invoiceDoc.uuid === invoiceUuid
            ? {
                ...invoiceDoc,
                ...(updatedInvoice || {}),
                status: updatedStatus,
              }
            : invoiceDoc
        )
      )
    } catch (updateError) {
      setInvoices(previousInvoices)
      setError(updateError.message || 'Unable to update invoice status.')
    } finally {
      setUpdatingInvoiceUuid('')
    }
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

        <section className="invoice-toolbar" aria-label="Invoice filters">
          <div className="invoice-filter-group">
            <label className="invoice-filter-label" htmlFor="invoice-search">Search</label>
            <input
              id="invoice-search"
              className="invoice-filter-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Invoice ID, buyer, despatch reference..."
            />
          </div>
          <div className="invoice-filter-group invoice-filter-group-status">
            <label className="invoice-filter-label" htmlFor="invoice-status-filter">Status</label>
            <select
              id="invoice-status-filter"
              className="invoice-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="invoice-toolbar-meta">
            <span className="invoice-result-count">{filteredInvoices.length} shown</span>
            {(searchTerm.trim() || statusFilter !== 'All') ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            ) : null}
          </div>
        </section>

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
          ) : filteredInvoices.length === 0 ? (
            <div className="invoice-empty">
              <Receipt className="invoice-empty-icon" aria-hidden="true" />
              <p>No invoices match the current filters.</p>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : (
            <table className="invoice-table" aria-label="Invoices list">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Source</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.uuid} className={updatingInvoiceUuid === inv.uuid ? 'invoice-row-updating' : ''}>
                    <td className="invoice-id-cell">
                      <span className="invoice-id-badge">{inv.displayId}</span>
                    </td>
                    <td>
                      {inv.despatchUuid ? (
                        <Link to={`/despatch/${inv.despatchUuid}`} className="invoice-ref-link">{inv.despatchDisplayId || inv.despatchUuid}</Link>
                      ) : (
                        <span className="invoice-ref-empty">Whole Order</span>
                      )}
                    </td>
                    <td>{inv.buyer}</td>
                    <td className="invoice-total-cell">{formatCurrencyValue(inv.total)}</td>
                    <td>
                      <div className="invoice-status-cell">
                        <span className={`invoice-status-badge ${STATUS_CLASS[normaliseInvoiceStatus(inv.status)] ?? ''}`}>
                          {normaliseInvoiceStatus(inv.status)}
                        </span>
                        <select
                          className="invoice-status-select"
                          value={normaliseInvoiceStatus(inv.status)}
                          onChange={(event) => handleStatusChange(inv.uuid, event.target.value)}
                          disabled={updatingInvoiceUuid === inv.uuid}
                          aria-label={`Set status for invoice ${inv.displayId || inv.uuid}`}
                        >
                          {STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>{statusOption}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="invoice-date-cell">{inv.issueDate}</td>
                    <td className="invoice-date-cell">{inv.dueDate || '-'}</td>
                    <td className="invoice-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link className="invoice-view-link" to={`/invoice/${inv.uuid}`}>View</Link>
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
