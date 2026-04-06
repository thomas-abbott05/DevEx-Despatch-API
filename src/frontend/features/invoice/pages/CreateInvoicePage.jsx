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
import { fetchOrderDetail, fetchOrderSummaries } from '@/features/orders/api/orders-api'
import { createInvoiceDocument } from '../api/invoice-api'
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

const DEFAULT_EDITOR_UNIT_PRICE = 1

function buildLineIdCandidates(lineIdValue) {
  const lineId = String(lineIdValue || '').trim()
  if (!lineId) {
    return []
  }

  const candidates = new Set([lineId])
  const linePrefixMatch = /^LINE-(\d+)$/i.exec(lineId)

  if (linePrefixMatch) {
    const numericPart = linePrefixMatch[1]
    const normalizedNumber = String(Number(numericPart))

    candidates.add(numericPart)
    candidates.add(normalizedNumber)
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'))
  }

  const numericMatch = /^\d+$/.exec(lineId)
  if (numericMatch) {
    const normalizedNumber = String(Number(lineId))

    candidates.add(normalizedNumber)
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'))
  }

  return Array.from(candidates)
}

function readLineUnitPrice(line) {
  const directUnitPrice = toNumber(line?.unitPrice)
  if (Number.isFinite(directUnitPrice) && directUnitPrice > 0) {
    return roundCurrency(directUnitPrice)
  }

  const nestedUnitPrice = toNumber(line?.lineItem?.price?.priceAmount)
  if (Number.isFinite(nestedUnitPrice) && nestedUnitPrice > 0) {
    return roundCurrency(nestedUnitPrice)
  }

  const linePriceAmount = toNumber(line?.price?.priceAmount)
  if (Number.isFinite(linePriceAmount) && linePriceAmount > 0) {
    return roundCurrency(linePriceAmount)
  }

  return NaN
}

function buildOrderUnitPriceByLineCandidate(orderDetail) {
  const orderLines = Array.isArray(orderDetail?.orderLines) ? orderDetail.orderLines : []
  const unitPriceByCandidate = new Map()

  orderLines.forEach((orderLine, index) => {
    const unitPrice = readLineUnitPrice(orderLine)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return
    }

    const fallbackLineId = String(index + 1)
    const lineIdCandidates = buildLineIdCandidates(orderLine?.lineId || fallbackLineId)

    lineIdCandidates.forEach((candidate) => {
      if (!unitPriceByCandidate.has(candidate)) {
        unitPriceByCandidate.set(candidate, unitPrice)
      }
    })
  })

  return unitPriceByCandidate
}

function resolveLineUnitPrice(line, orderUnitPriceByCandidate) {
  const directUnitPrice = readLineUnitPrice(line)
  if (Number.isFinite(directUnitPrice) && directUnitPrice > 0) {
    return directUnitPrice
  }

  const lineCandidates = [
    ...buildLineIdCandidates(line?.orderLineId),
    ...buildLineIdCandidates(line?.lineId)
  ]

  for (let candidateIndex = 0; candidateIndex < lineCandidates.length; candidateIndex += 1) {
    const candidate = lineCandidates[candidateIndex]
    const candidatePrice = orderUnitPriceByCandidate.get(candidate)

    if (Number.isFinite(candidatePrice) && candidatePrice > 0) {
      return candidatePrice
    }
  }

  return roundCurrency(DEFAULT_EDITOR_UNIT_PRICE)
}

function buildEditableLinesFromDespatch(despatchDetail, orderDetail) {
  const despatchLines = Array.isArray(despatchDetail?.lines) ? despatchDetail.lines : []
  const orderUnitPriceByCandidate = buildOrderUnitPriceByLineCandidate(orderDetail)

  return despatchLines
    .map((line, index) => {
      const quantity = toNumber(line?.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null
      }

      return {
        lineId: line?.lineId || String(index + 1),
        orderLineId: line?.orderLineId || line?.lineId || String(index + 1),
        description: line?.description || line?.itemName || 'Line Item ' + String(index + 1),
        quantity: String(quantity),
        unitPrice: String(resolveLineUnitPrice(line, orderUnitPriceByCandidate))
      }
    })
    .filter(Boolean)
}

function buildEditableLinesFromOrder(orderDetail) {
  const orderLines = Array.isArray(orderDetail?.orderLines) ? orderDetail.orderLines : []
  const orderUnitPriceByCandidate = buildOrderUnitPriceByLineCandidate(orderDetail)

  return orderLines
    .map((line, index) => {
      const quantity = toNumber(line?.requestedQuantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null
      }

      return {
        lineId: line?.lineId || String(index + 1),
        orderLineId: line?.lineId || String(index + 1),
        description: line?.description || line?.itemName || 'Line Item ' + String(index + 1),
        quantity: String(quantity),
        unitPrice: String(resolveLineUnitPrice(line, orderUnitPriceByCandidate))
      }
    })
    .filter(Boolean)
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedDespatchUuid = searchParams.get('despatchUuid') || ''
  const preselectedOrderUuid = searchParams.get('orderUuid') || ''
  const { user, logout } = useAuth()

  const [orders, setOrders] = useState([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [despatches, setDespatches] = useState([])
  const [despatchesLoaded, setDespatchesLoaded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBaseOrder, setSelectedBaseOrder] = useState(null)
  const [selectedBaseOrderDetail, setSelectedBaseOrderDetail] = useState(null)
  const [despatchDetailCache, setDespatchDetailCache] = useState({})
  const [invoiceSourceType, setInvoiceSourceType] = useState('order')
  const [invoiceSourceDespatchUuid, setInvoiceSourceDespatchUuid] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  const [issueDate, setIssueDate] = useState(todayIsoDate)
  const [dueDate, setDueDate] = useState(todayIsoDate)
  const [currency, setCurrency] = useState('AUD')
  const [gstPercent, setGstPercent] = useState('10')
  const [supplierAbn, setSupplierAbn] = useState('')
  const [customerAbn, setCustomerAbn] = useState('')
  const [editableLines, setEditableLines] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchWrapRef = useRef(null)
  const preloadedOrderUuidRef = useRef('')
  const preloadedDespatchUuidRef = useRef('')

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Invoices', to: '/invoice' },
    { label: 'Create Invoice' }
  ]

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return orders.slice(0, 8)
    }

    return orders
      .filter((order) => {
        const haystack = [
          order?.displayId,
          order?.buyer,
          order?.supplier,
          order?.status,
          order?.issueDate
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [orders, searchTerm])

  const orderScopedDespatches = useMemo(() => {
    if (!selectedBaseOrder?.uuid) {
      return []
    }

    return despatches.filter((despatch) => despatch?.orderUuid === selectedBaseOrder.uuid)
  }, [despatches, selectedBaseOrder?.uuid])

  const linePreview = useMemo(() => {
    return editableLines.map((line, index) => {
      const quantity = toNumber(line?.quantity)
      const unitPrice = toNumber(line?.unitPrice)
      const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice)
        ? roundCurrency(quantity * unitPrice)
        : NaN

      return {
        key: `${line?.lineId || 'line'}-${index}`,
        lineId: line?.lineId || '-',
        description: line?.description || '',
        quantity,
        unitPrice,
        lineTotal
      }
    })
  }, [editableLines])

  const invoiceTotals = useMemo(() => {
    const totalAmount = roundCurrency(
      linePreview.reduce((accumulator, line) => accumulator + (Number.isFinite(line.lineTotal) ? line.lineTotal : 0), 0)
    )

    const parsedGstPercent = toNumber(gstPercent)
    const safeGstPercent = Number.isFinite(parsedGstPercent) ? parsedGstPercent : 0
    const divisor = 1 + (safeGstPercent / 100)
    const linesTotal = safeGstPercent > 0 && divisor > 0
      ? roundCurrency(totalAmount / divisor)
      : totalAmount
    const gstAmount = roundCurrency(totalAmount - linesTotal)

    return {
      linesTotal,
      gstAmount,
      totalAmount
    }
  }, [gstPercent, linePreview])

  const loadOrderOptions = useCallback(async () => {
    if (ordersLoaded || ordersLoading) {
      return orders
    }

    setOrdersLoading(true)

    try {
      const summaries = await fetchOrderSummaries()
      setOrders(summaries)
      setOrdersLoaded(true)
      return summaries
    } catch (loadError) {
      setError(loadError.message || 'Unable to load order options.')
      return []
    } finally {
      setOrdersLoading(false)
    }
  }, [orders, ordersLoaded, ordersLoading])

  const loadDespatchOptions = useCallback(async () => {
    if (despatchesLoaded) {
      return despatches
    }

    try {
      const summaries = await fetchDespatchSummaries()
      setDespatches(summaries)
      setDespatchesLoaded(true)
      return summaries
    } catch (loadError) {
      setError(loadError.message || 'Unable to load despatch options.')
      return []
    }
  }, [despatches, despatchesLoaded])

  const getDespatchDetailByUuid = useCallback(async (uuid) => {
    if (!uuid) {
      return null
    }

    if (despatchDetailCache[uuid]) {
      return despatchDetailCache[uuid]
    }

    const detail = await fetchDespatchDetail(uuid)
    setDespatchDetailCache((previous) => ({
      ...previous,
      [uuid]: detail
    }))

    return detail
  }, [despatchDetailCache])

  const resetLinesFromCurrentSource = useCallback(async (sourceType, sourceDespatchUuid, orderDetailOverride = null) => {
    if (sourceType === 'order') {
      const orderDetail = orderDetailOverride || selectedBaseOrderDetail
      if (!orderDetail) {
        setEditableLines([])
        return
      }

      setEditableLines(buildEditableLinesFromOrder(orderDetail))
      return
    }

    if (!sourceDespatchUuid) {
      setEditableLines([])
      return
    }

    const sourceDespatchDetail = await getDespatchDetailByUuid(sourceDespatchUuid)
    setEditableLines(buildEditableLinesFromDespatch(sourceDespatchDetail, selectedBaseOrderDetail))
  }, [getDespatchDetailByUuid, selectedBaseOrderDetail])

  const selectBaseOrder = useCallback(async (orderSummary) => {
    setError('')
    setDetailLoading(true)

    try {
      const detail = await fetchOrderDetail(orderSummary.uuid)
      if (!detail) {
        throw new Error('Unable to load selected order detail.')
      }

      setSelectedBaseOrder({
        uuid: detail.uuid,
        displayId: detail.displayId,
        buyer: detail.buyer,
        supplier: detail.supplier,
        status: detail.status,
        issueDate: detail.issueDate,
        lineItems: detail.lineItems
      })
      setSelectedBaseOrderDetail(detail)
      setSupplierAbn(String(detail?.supplierAbn || ''))
      const detailCustomerAbn = String(detail?.customerAbn || '').trim()
      if (detailCustomerAbn) {
        setCustomerAbn(detailCustomerAbn)
      }
      setSearchTerm(detail.displayId)
      setSearchOpen(false)
      setInvoiceSourceType('order')

      await loadDespatchOptions()
      setInvoiceSourceDespatchUuid('')
      await resetLinesFromCurrentSource('order', '', detail)
    } catch (selectionError) {
      setError(selectionError.message || 'Unable to load selected order detail.')
      setSelectedBaseOrder(null)
      setSelectedBaseOrderDetail(null)
      setInvoiceSourceDespatchUuid('')
      setEditableLines([])
    } finally {
      setDetailLoading(false)
    }
  }, [loadDespatchOptions, resetLinesFromCurrentSource])

  useEffect(() => {
    if (!preselectedOrderUuid || preselectedDespatchUuid) {
      return
    }

    if (preloadedOrderUuidRef.current === preselectedOrderUuid) {
      return
    }

    if (selectedBaseOrder?.uuid === preselectedOrderUuid) {
      return
    }

    preloadedOrderUuidRef.current = preselectedOrderUuid

    selectBaseOrder({ uuid: preselectedOrderUuid })
  }, [
    preselectedOrderUuid,
    preselectedDespatchUuid,
    selectBaseOrder,
    selectedBaseOrder?.uuid
  ])

  useEffect(() => {
    async function preloadSelectedDespatch() {
      if (!preselectedDespatchUuid) {
        return
      }

      if (preloadedDespatchUuidRef.current === preselectedDespatchUuid) {
        return
      }

      preloadedDespatchUuidRef.current = preselectedDespatchUuid

      setError('')
      setDetailLoading(true)

      try {
        const despatchDetail = await getDespatchDetailByUuid(preselectedDespatchUuid)
        if (!despatchDetail?.orderUuid) {
          throw new Error('Selected despatch is not linked to an order.')
        }

        const orderDetail = await fetchOrderDetail(despatchDetail.orderUuid)
        if (!orderDetail) {
          throw new Error('Unable to load linked order detail.')
        }

        setSelectedBaseOrder({
          uuid: orderDetail.uuid,
          displayId: orderDetail.displayId,
          buyer: orderDetail.buyer,
          supplier: orderDetail.supplier,
          status: orderDetail.status,
          issueDate: orderDetail.issueDate,
          lineItems: orderDetail.lineItems
        })
        setSelectedBaseOrderDetail(orderDetail)
        setSupplierAbn(String(orderDetail?.supplierAbn || ''))
        const orderCustomerAbn = String(orderDetail?.customerAbn || '').trim()
        if (orderCustomerAbn) {
          setCustomerAbn(orderCustomerAbn)
        }
        setSearchTerm(orderDetail.displayId)
        setInvoiceSourceType('despatch')
        setInvoiceSourceDespatchUuid(preselectedDespatchUuid)

        await loadOrderOptions()
        await loadDespatchOptions()
        await resetLinesFromCurrentSource('despatch', preselectedDespatchUuid)
      } catch (selectionError) {
        setError(selectionError.message || 'Unable to preload invoice context.')
      } finally {
        setDetailLoading(false)
      }
    }

    preloadSelectedDespatch()
  }, [
    getDespatchDetailByUuid,
    loadDespatchOptions,
    loadOrderOptions,
    preselectedDespatchUuid,
    resetLinesFromCurrentSource
  ])

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
    await loadOrderOptions()
    setSearchOpen(true)
  }

  async function handleSourceTypeChange(nextSourceType) {
    if (!selectedBaseOrder) {
      setInvoiceSourceType(nextSourceType)
      return
    }

    setInvoiceSourceType(nextSourceType)
    setError('')
    setDetailLoading(true)

    try {
      if (nextSourceType === 'order') {
        setInvoiceSourceDespatchUuid('')
        await resetLinesFromCurrentSource('order', '')
        return
      }

      const availableDespatches = despatchesLoaded ? despatches : await loadDespatchOptions()
      const scopedDespatches = availableDespatches.filter((despatch) => despatch?.orderUuid === selectedBaseOrder.uuid)
      const preferredDespatchUuid = scopedDespatches.some((despatch) => despatch.uuid === invoiceSourceDespatchUuid)
        ? invoiceSourceDespatchUuid
        : (scopedDespatches[0]?.uuid || '')

      if (!preferredDespatchUuid) {
        setInvoiceSourceDespatchUuid('')
        setEditableLines([])
        setError('No despatch advice exists for the selected base order.')
        return
      }

      setInvoiceSourceDespatchUuid(preferredDespatchUuid)
  await resetLinesFromCurrentSource('despatch', preferredDespatchUuid)
    } catch (updateError) {
      setError(updateError.message || 'Unable to update invoice source.')
      setEditableLines([])
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleInvoiceSourceDespatchChange(nextDespatchUuid) {
    setInvoiceSourceDespatchUuid(nextDespatchUuid)
    setError('')
    setDetailLoading(true)

    try {
      await resetLinesFromCurrentSource('despatch', nextDespatchUuid)
    } catch (updateError) {
      setError(updateError.message || 'Unable to load selected despatch source.')
      setEditableLines([])
    } finally {
      setDetailLoading(false)
    }
  }

  function handleEditableLineChange(index, field, value) {
    setEditableLines((previousLines) => previousLines.map((line, lineIndex) => {
      if (lineIndex !== index) {
        return line
      }

      return {
        ...line,
        [field]: value
      }
    }))
  }

  function applyDefaultPriceToAllLines() {
    const resolvedUnitPrice = String(roundCurrency(DEFAULT_EDITOR_UNIT_PRICE))
    setEditableLines((previousLines) => previousLines.map((line) => ({
      ...line,
      unitPrice: resolvedUnitPrice
    })))
  }

  function validateForm() {
    if (!selectedBaseOrder) {
      return 'Select a base order first.'
    }

    if (!issueDate.trim() || !dueDate.trim()) {
      return 'Issue date and due date are required.'
    }

    const parsedGstPercent = toNumber(gstPercent)
    if (!Number.isFinite(parsedGstPercent) || parsedGstPercent < 0) {
      return 'GST percent must be 0 or greater.'
    }

    if (!supplierAbn.trim()) {
      return 'Supplier ABN is required for invoice generation.'
    }

    if (invoiceSourceType === 'despatch' && !invoiceSourceDespatchUuid) {
      return 'Choose a despatch advice source for despatch-level invoicing.'
    }

    if (!editableLines.length) {
      return 'No invoice lines are available for the selected scope.'
    }

    const hasInvalidLine = editableLines.some((line) => {
      const quantity = toNumber(line.quantity)
      const unitPrice = toNumber(line.unitPrice)

      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0
    })

    if (hasInvalidLine) {
      return 'Each invoice line must include quantity and unit price values greater than 0.'
    }

    return ''
  }

  function buildCreatePayload() {
    return {
      baseOrderUuid: selectedBaseOrder.uuid,
      invoiceSourceType,
      invoiceSourceDespatchUuid: invoiceSourceType === 'despatch' ? invoiceSourceDespatchUuid : '',
      issueDate,
      dueDate,
      currency: currency.trim().toUpperCase(),
      gstPercent: Number(gstPercent),
      supplierAbn: supplierAbn.trim(),
      customerAbn: customerAbn.trim(),
      manualLinesIncludeGst: true,
      manualLines: editableLines.map((line, index) => ({
        lineId: line.lineId || String(index + 1),
        orderLineId: line.orderLineId || line.lineId || String(index + 1),
        description: line.description || 'Line Item ' + String(index + 1),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice)
      }))
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
      const createdInvoice = await createInvoiceDocument(buildCreatePayload())
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
            <p className="create-invoice-subtitle">Select a base order, choose whole-order or despatch scope, and edit GST-inclusive line pricing before generating.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="create-invoice-nav-btn">
            <Link to="/invoice" className="create-invoice-back-btn">Back to invoices</Link>
          </Button>
        </header>

        <div className="create-invoice-card">
          <form className="create-invoice-form" onSubmit={handleSubmit}>
            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">1. Select Base Order</h2>

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
                    placeholder="Search order ID, buyer, supplier, status..."
                    aria-label="Search orders"
                  />
                </div>

                {searchOpen ? (
                  <div className="create-invoice-search-results" role="listbox" aria-label="Recent orders">
                    {ordersLoading ? (
                      <div className="create-invoice-search-feedback">
                        <PurpleBarLoader statusLabel="Loading order options" maxWidth="220px" />
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="create-invoice-search-feedback">No matching orders found.</div>
                    ) : (
                      filteredOrders.map((order) => (
                        <button
                          key={order.uuid}
                          type="button"
                          className="create-invoice-search-option"
                          onClick={() => selectBaseOrder(order)}
                        >
                          <span className="create-invoice-search-id">{order.displayId}</span>
                          <span>{order.buyer || 'Unknown Buyer'} • {order.status || 'Pending'}</span>
                          <span className="create-invoice-search-meta">{order.issueDate || 'No date'}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {selectedBaseOrder ? (
                <dl className="create-invoice-despatch-summary">
                  <div>
                    <dt>Base Order</dt>
                    <dd>{selectedBaseOrder.displayId}</dd>
                  </div>
                  <div>
                    <dt>Buyer</dt>
                    <dd>{selectedBaseOrder.buyer || '-'}</dd>
                  </div>
                  <div>
                    <dt>Supplier</dt>
                    <dd>{selectedBaseOrder.supplier || '-'}</dd>
                  </div>
                  <div>
                    <dt>Line Items</dt>
                    <dd>{Number(selectedBaseOrder.lineItems) || 0}</dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">2. Invoice Scope</h2>

              <div className="create-invoice-grid create-invoice-grid-two">
                <div className="create-invoice-field">
                  <label htmlFor="invoice-source-type">Invoice for</label>
                  <select
                    id="invoice-source-type"
                    className="create-invoice-select"
                    value={invoiceSourceType}
                    onChange={(event) => handleSourceTypeChange(event.target.value)}
                    disabled={!selectedBaseOrder || detailLoading}
                  >
                    <option value="order">Whole Order</option>
                    <option value="despatch">One Despatch Advice</option>
                  </select>
                </div>

                {invoiceSourceType === 'despatch' ? (
                  <div className="create-invoice-field">
                    <label htmlFor="invoice-source-despatch">Despatch Advice Source</label>
                    <select
                      id="invoice-source-despatch"
                      className="create-invoice-select"
                      value={invoiceSourceDespatchUuid}
                      onChange={(event) => handleInvoiceSourceDespatchChange(event.target.value)}
                      disabled={!selectedBaseOrder || detailLoading || !orderScopedDespatches.length}
                    >
                      <option value="">Select despatch advice</option>
                      {orderScopedDespatches.map((despatch) => (
                        <option key={despatch.uuid} value={despatch.uuid}>
                          {despatch.displayId} ({despatch.issueDate || 'No date'})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="create-invoice-field create-invoice-source-note">
                    <label>Scope Summary</label>
                    <p>
                      {selectedBaseOrder?.displayId
                        ? `Whole order ${selectedBaseOrder.displayId} with ${Number(selectedBaseOrder.lineItems) || 0} line items.`
                        : 'Select a base order to enable whole-order invoicing.'}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="create-invoice-section">
              <h2 className="create-invoice-section-title">3. Invoice Configuration</h2>

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
              <div className="create-invoice-section-heading-row">
                <h2 className="create-invoice-section-title">4. Invoice Line Editing</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="create-invoice-reset-btn"
                  onClick={applyDefaultPriceToAllLines}
                  disabled={!editableLines.length || detailLoading || submitting}
                >
                  Reset Unit Prices To $1.00
                </Button>
              </div>

              {detailLoading ? (
                <div className="create-invoice-detail-loading">
                  <PurpleBarLoader statusLabel="Loading invoice lines" maxWidth="220px" />
                </div>
              ) : !editableLines.length ? (
                <p className="create-invoice-empty">Select a base order and source scope to prepare invoice lines.</p>
              ) : (
                <>
                  <table className="create-invoice-lines-table" aria-label="Editable invoice line table">
                    <thead>
                      <tr>
                        <th>Line ID</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price (inc GST)</th>
                        <th>Line Total (inc GST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linePreview.map((line, index) => (
                        <tr key={line.key}>
                          <td>{line.lineId}</td>
                          <td>
                            <Input
                              value={editableLines[index]?.description || ''}
                              onChange={(event) => handleEditableLineChange(index, 'description', event.target.value)}
                              aria-label={`Line description ${line.lineId}`}
                            />
                          </td>
                          <td>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editableLines[index]?.quantity || ''}
                              onChange={(event) => handleEditableLineChange(index, 'quantity', event.target.value)}
                              aria-label={`Line quantity ${line.lineId}`}
                            />
                          </td>
                          <td>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editableLines[index]?.unitPrice || ''}
                              onChange={(event) => handleEditableLineChange(index, 'unitPrice', event.target.value)}
                              aria-label={`Line unit price ${line.lineId}`}
                            />
                          </td>
                          <td className="create-invoice-line-total-cell">
                            {Number.isFinite(line.lineTotal) ? line.lineTotal.toFixed(2) : '-'}
                          </td>
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
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="create-invoice-submit-btn"
                disabled={submitting || detailLoading || !editableLines.length}
              >
                {submitting ? 'Creating Invoice...' : 'Create Invoice'}
              </Button>
              <Button asChild type="button" variant="ghost" size="sm" className="create-invoice-cancel-btn" disabled={submitting}>
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