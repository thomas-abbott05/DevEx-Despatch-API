import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchDespatchDetail, fetchDespatchSummaries } from '@/features/despatch/api/despatch-api'
import { createInvoiceFromDespatch } from '../api/invoice-api'
import './styles/CreateInvoicePage.css'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function buildPreviewLines(despatchDetail, defaultUnitPrice) {
  const despatchLines = Array.isArray(despatchDetail?.lines) ? despatchDetail.lines : []

  return despatchLines
    .map((line, index) => {
      const quantity = toNumber(line.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null
      }

      const unitPrice = roundCurrency(defaultUnitPrice)
      const lineTotal = roundCurrency(quantity * unitPrice)

      return {
        lineId: line.lineId || String(index + 1),
        description: line.description || line.itemName || 'Line Item ' + String(index + 1),
        quantity,
        unitPrice,
        lineTotal
      }
    })
    .filter(Boolean)
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedDespatchUuid = searchParams.get('despatchUuid') || ''
  const { user, logout } = useAuth()

  const [despatches, setDespatches] = useState([])
  const [despatchesLoaded, setDespatchesLoaded] = useState(false)
  const [despatchesLoading, setDespatchesLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDespatch, setSelectedDespatch] = useState(null)
  const [despatchDetail, setDespatchDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [issueDate, setIssueDate] = useState(todayIsoDate)
  const [dueDate, setDueDate] = useState(todayIsoDate)
  const [currency, setCurrency] = useState('AUD')
  const [gstPercent, setGstPercent] = useState('10')
  const [defaultUnitPrice, setDefaultUnitPrice] = useState('1')
  const [supplierAbn, setSupplierAbn] = useState('')
  const [customerAbn, setCustomerAbn] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchWrapRef = useRef(null)

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Invoices', to: '/invoice' },
    { label: 'Create Invoice' }
  ]

  const previewLines = useMemo(() => {
    const parsedDefaultUnitPrice = toNumber(defaultUnitPrice)
    const safeUnitPrice = Number.isFinite(parsedDefaultUnitPrice) && parsedDefaultUnitPrice > 0 ? parsedDefaultUnitPrice : 1
    return buildPreviewLines(despatchDetail, safeUnitPrice)
  }, [defaultUnitPrice, despatchDetail])

  const invoiceTotals = useMemo(() => {
    const linesTotal = roundCurrency(previewLines.reduce((accumulator, line) => accumulator + line.lineTotal, 0))
    const parsedGstPercent = toNumber(gstPercent)
    const safeGstPercent = Number.isFinite(parsedGstPercent) ? parsedGstPercent : 0
    const gstAmount = roundCurrency(linesTotal * (safeGstPercent / 100))
    const totalAmount = roundCurrency(linesTotal + gstAmount)

    return {
      linesTotal,
      gstAmount,
      totalAmount
    }
  }, [gstPercent, previewLines])

  const filteredDespatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return despatches.slice(0, 8)
    }

    return despatches
      .filter((despatch) => {
        const haystack = [
          despatch.displayId,
          despatch.orderDisplayId,
          despatch.status
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [despatches, searchTerm])

  const loadDespatchOptions = useCallback(async () => {
    if (despatchesLoaded || despatchesLoading) {
      return
    }

    setDespatchesLoading(true)

    try {
      const summaries = await fetchDespatchSummaries()
      setDespatches(summaries)
      setDespatchesLoaded(true)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load despatch options.')
    } finally {
      setDespatchesLoading(false)
    }
  }, [despatchesLoaded, despatchesLoading])

  const selectDespatch = useCallback(async (despatchSummary) => {
    setError('')
    setDetailLoading(true)

    try {
      const detail = await fetchDespatchDetail(despatchSummary.uuid)
      if (!detail) {
        throw new Error('Unable to load selected despatch detail.')
      }

      setSelectedDespatch({
        uuid: detail.uuid,
        displayId: detail.displayId,
        orderDisplayId: detail.orderDisplayId,
        status: detail.status,
        issueDate: detail.issueDate
      })
      setDespatchDetail(detail)
      setSearchTerm(detail.displayId)
      setSearchOpen(false)
    } catch (selectionError) {
      setError(selectionError.message || 'Unable to load selected despatch detail.')
      setSelectedDespatch(null)
      setDespatchDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    async function preloadSelectedDespatch() {
      if (!preselectedDespatchUuid) {
        return
      }

      if (selectedDespatch?.uuid === preselectedDespatchUuid) {
        return
      }

      setError('')
      setDetailLoading(true)

      try {
        const detail = await fetchDespatchDetail(preselectedDespatchUuid)
        if (!detail) {
          throw new Error('Unable to load selected despatch detail.')
        }

        setSelectedDespatch({
          uuid: detail.uuid,
          displayId: detail.displayId,
          orderDisplayId: detail.orderDisplayId,
          status: detail.status,
          issueDate: detail.issueDate
        })
        setDespatchDetail(detail)
        setSearchTerm(detail.displayId)
      } catch (selectionError) {
        setError(selectionError.message || 'Unable to load selected despatch detail.')
      } finally {
        setDetailLoading(false)
      }
    }

    preloadSelectedDespatch()
  }, [preselectedDespatchUuid, selectedDespatch?.uuid])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleSearchFocus() {
    await loadDespatchOptions()
    setSearchOpen(true)
  }

  function validateForm() {
    if (!selectedDespatch) {
      return 'Select a base despatch advice first.'
    }

    if (!issueDate.trim() || !dueDate.trim()) {
      return 'Issue date and due date are required.'
    }

    const parsedDefaultUnitPrice = toNumber(defaultUnitPrice)
    if (!Number.isFinite(parsedDefaultUnitPrice) || parsedDefaultUnitPrice <= 0) {
      return 'Default unit price must be greater than 0.'
    }

    const parsedGstPercent = toNumber(gstPercent)
    if (!Number.isFinite(parsedGstPercent) || parsedGstPercent < 0) {
      return 'GST percent must be 0 or greater.'
    }

    if (!supplierAbn.trim()) {
      return 'Supplier ABN is required for invoice generation.'
    }

    if (!previewLines.length) {
      return 'Selected despatch does not contain invoice-ready lines.'
    }

    return ''
  }

  function buildCreatePayload() {
    return {
      despatchUuid: selectedDespatch.uuid,
      issueDate,
      dueDate,
      currency: currency.trim().toUpperCase(),
      gstPercent: Number(gstPercent),
      defaultUnitPrice: Number(defaultUnitPrice),
      supplierAbn: supplierAbn.trim(),
      customerAbn: customerAbn.trim()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const createdInvoice = await createInvoiceFromDespatch(buildCreatePayload())
      if (createdInvoice?.uuid) {
        navigate('/invoice/' + createdInvoice.uuid)
        return
      }

      navigate('/invoice')
    } catch (createError) {
      setError(createError.message || 'Unable to create invoice document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="home-screen create-invoice-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content create-invoice-content">
        <header className="create-invoice-header">
          <div>
            <h1 className="create-invoice-title">Create Invoice</h1>
            <p className="create-invoice-subtitle">Select a base despatch advice and generate an invoice with auto-derived lines.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/invoice">Back to invoices</Link>
          </Button>
        </header>

        <div className="create-invoice-card">
          <form className="create-invoice-form" onSubmit={handleSubmit}>
            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">Select Base Despatch Advice</h2>

              <div className="create-invoice-search-wrap" ref={searchWrapRef}>
                <div className="create-invoice-search-input-wrap">
                  <Search className="create-invoice-search-icon size-4" aria-hidden="true" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setSearchOpen(true)
                    }}
                    onFocus={handleSearchFocus}
                    placeholder="Search despatch ID, order reference, status..."
                    aria-label="Search despatch documents"
                  />
                </div>

                {searchOpen ? (
                  <div className="create-invoice-search-results" role="listbox" aria-label="Recent despatch documents">
                    {despatchesLoading ? (
                      <div className="create-invoice-search-feedback">
                        <PurpleBarLoader statusLabel="Loading despatch options" maxWidth="220px" />
                      </div>
                    ) : filteredDespatches.length === 0 ? (
                      <div className="create-invoice-search-feedback">No matching despatch documents found.</div>
                    ) : (
                      filteredDespatches.map((despatch) => (
                        <button
                          key={despatch.uuid}
                          type="button"
                          className="create-invoice-search-option"
                          onClick={() => selectDespatch(despatch)}
                        >
                          <span className="create-invoice-search-id">{despatch.displayId}</span>
                          <span>Order {despatch.orderDisplayId}</span>
                          <span className="create-invoice-search-meta">{despatch.issueDate}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {selectedDespatch ? (
                <dl className="create-invoice-despatch-summary">
                  <div>
                    <dt>Despatch ID</dt>
                    <dd>{selectedDespatch.displayId}</dd>
                  </div>
                  <div>
                    <dt>Order Reference</dt>
                    <dd>{selectedDespatch.orderDisplayId}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedDespatch.status}</dd>
                  </div>
                  <div>
                    <dt>Issue Date</dt>
                    <dd>{selectedDespatch.issueDate}</dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">Invoice Configuration</h2>

              <div className="create-invoice-grid create-invoice-grid-two">
                <div className="create-invoice-field">
                  <label htmlFor="invoice-issue-date">Issue Date</label>
                  <Input id="invoice-issue-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-due-date">Due Date</label>
                  <Input id="invoice-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-currency">Currency</label>
                  <Input id="invoice-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} placeholder="AUD" />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-gst">GST Percent</label>
                  <Input id="invoice-gst" type="number" min="0" step="0.01" value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-default-price">Default Unit Price</label>
                  <Input
                    id="invoice-default-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={defaultUnitPrice}
                    onChange={(event) => setDefaultUnitPrice(event.target.value)}
                  />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-supplier-abn">Supplier ABN</label>
                  <Input
                    id="invoice-supplier-abn"
                    value={supplierAbn}
                    onChange={(event) => setSupplierAbn(event.target.value)}
                    placeholder="12345678987"
                  />
                </div>
                <div className="create-invoice-field">
                  <label htmlFor="invoice-customer-abn">Customer ABN (optional)</label>
                  <Input
                    id="invoice-customer-abn"
                    value={customerAbn}
                    onChange={(event) => setCustomerAbn(event.target.value)}
                    placeholder="12345678987"
                  />
                </div>
              </div>
            </section>

            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">Auto-Derived Invoice Lines</h2>

              {detailLoading ? (
                <div className="create-invoice-detail-loading">
                  <PurpleBarLoader statusLabel="Loading despatch lines" maxWidth="220px" />
                </div>
              ) : !previewLines.length ? (
                <p className="create-invoice-empty">Select a despatch advice to preview invoice lines.</p>
              ) : (
                <>
                  <table className="create-invoice-lines-table" aria-label="Invoice line preview">
                    <thead>
                      <tr>
                        <th>Line ID</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLines.map((line) => (
                        <tr key={line.lineId}>
                          <td>{line.lineId}</td>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{line.unitPrice.toFixed(2)}</td>
                          <td>{line.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <dl className="create-invoice-totals">
                    <div>
                      <dt>Lines Total (ex GST)</dt>
                      <dd>{invoiceTotals.linesTotal.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>GST Amount</dt>
                      <dd>{invoiceTotals.gstAmount.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>Total Amount</dt>
                      <dd>{invoiceTotals.totalAmount.toFixed(2)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </section>

            {error ? <p className="create-invoice-error" role="alert">{error}</p> : null}

            <div className="create-invoice-actions">
              <Button type="submit" variant="secondary" size="sm" disabled={submitting || detailLoading || !previewLines.length}>
                {submitting ? 'Creating Invoice...' : 'Create Invoice'}
              </Button>
              <Button asChild type="button" variant="ghost" size="sm" disabled={submitting}>
                <Link to="/invoice">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
