import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { createDespatchFromOrder } from '../api/despatch-api'
import { fetchOrderDetail, fetchOrderSummaries } from '@/features/orders/api/orders-api'
import './styles/CreateDespatchPage.css'

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function buildLineSelections(orderDetail) {
  const lines = Array.isArray(orderDetail?.orderLines) ? orderDetail.orderLines : []

  return lines.map((line, index) => {
    const requestedQuantityRaw = toNumber(line.requestedQuantity)
    const requestedQuantity = Number.isFinite(requestedQuantityRaw) ? requestedQuantityRaw : 0
    const destinationOptions = Array.isArray(line.destinationOptions) ? line.destinationOptions : []
    const firstDestination = destinationOptions[0] || null

    return {
      lineId: line.lineId || 'LINE-' + String(index + 1).padStart(3, '0'),
      itemName: line.itemName || 'Line Item ' + String(index + 1),
      description: line.description || '',
      requestedQuantity,
      fulfilmentQuantity: requestedQuantity > 0 ? String(requestedQuantity) : '1',
      destinationOptions,
      destinationKey: firstDestination?.key || '',
      destinationAddress: firstDestination?.address || null
    }
  })
}

export default function CreateDespatchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedOrderUuid = searchParams.get('orderUuid') || ''
  const { user, logout } = useAuth()

  const [orders, setOrders] = useState([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [lineSelections, setLineSelections] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchWrapRef = useRef(null)

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Despatch Advice', to: '/despatch' },
    { label: 'Create Despatch Advice' }
  ]

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return orders.slice(0, 8)
    }

    return orders
      .filter((order) => {
        const haystack = [order.displayId, order.buyer, order.supplier, order.status].join(' ').toLowerCase()
        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [orders, searchTerm])

  const loadOrderOptions = useCallback(async () => {
    if (ordersLoaded || ordersLoading) {
      return
    }

    setOrdersLoading(true)

    try {
      const summaries = await fetchOrderSummaries()
      setOrders(summaries)
      setOrdersLoaded(true)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load order options.')
    } finally {
      setOrdersLoading(false)
    }
  }, [ordersLoaded, ordersLoading])

  const selectOrder = useCallback(async (orderSummary) => {
    setError('')
    setDetailLoading(true)

    try {
      const detail = await fetchOrderDetail(orderSummary.uuid)
      if (!detail) {
        throw new Error('Unable to load selected order detail.')
      }

      setSelectedOrder({
        uuid: detail.uuid,
        displayId: detail.displayId,
        buyer: detail.buyer,
        supplier: detail.supplier,
        status: detail.status,
        issueDate: detail.issueDate
      })
      setLineSelections(buildLineSelections(detail))
      setSearchTerm(detail.displayId)
      setSearchOpen(false)
    } catch (selectionError) {
      setError(selectionError.message || 'Unable to load selected order detail.')
      setSelectedOrder(null)
      setLineSelections([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    async function preloadSelectedOrder() {
      if (!preselectedOrderUuid) {
        return
      }

      if (selectedOrder?.uuid === preselectedOrderUuid) {
        return
      }

      setDetailLoading(true)
      setError('')

      try {
        const detail = await fetchOrderDetail(preselectedOrderUuid)
        if (!detail) {
          throw new Error('Unable to load selected order detail.')
        }

        setSelectedOrder({
          uuid: detail.uuid,
          displayId: detail.displayId,
          buyer: detail.buyer,
          supplier: detail.supplier,
          status: detail.status,
          issueDate: detail.issueDate
        })
        setLineSelections(buildLineSelections(detail))
        setSearchTerm(detail.displayId)
      } catch (selectionError) {
        setError(selectionError.message || 'Unable to load selected order detail.')
      } finally {
        setDetailLoading(false)
      }
    }

    preloadSelectedOrder()
  }, [preselectedOrderUuid, selectedOrder?.uuid])

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

  function updateLineSelection(lineId, updates) {
    setLineSelections((currentSelections) =>
      currentSelections.map((line) => (line.lineId === lineId ? { ...line, ...updates } : line))
    )
  }

  function handleQuantityChange(lineId, value) {
    updateLineSelection(lineId, { fulfilmentQuantity: value })
  }

  function handleDestinationChange(lineId, destinationKey) {
    setLineSelections((currentSelections) =>
      currentSelections.map((line) => {
        if (line.lineId !== lineId) {
          return line
        }

        const destination = line.destinationOptions.find((option) => option.key === destinationKey)

        return {
          ...line,
          destinationKey,
          destinationAddress: destination?.address || null
        }
      })
    )
  }

  function validateSelections() {
    if (!selectedOrder) {
      return 'Select a base order document first.'
    }

    if (!lineSelections.length) {
      return 'Selected order does not contain line item details.'
    }

    for (let index = 0; index < lineSelections.length; index += 1) {
      const line = lineSelections[index]
      const fulfilmentQuantity = Number(line.fulfilmentQuantity)

      if (!Number.isFinite(fulfilmentQuantity) || fulfilmentQuantity <= 0) {
        return 'Line ' + (index + 1) + ': fulfilment quantity must be greater than 0.'
      }

      if (fulfilmentQuantity > line.requestedQuantity) {
        return 'Line ' + (index + 1) + ': fulfilment quantity cannot exceed requested quantity.'
      }

      if (line.destinationOptions.length > 0 && !line.destinationAddress) {
        return 'Line ' + (index + 1) + ': select a destination address.'
      }
    }

    return ''
  }

  function buildCreatePayload() {
    return {
      orderUuid: selectedOrder.uuid,
      lineSelections: lineSelections.map((line) => ({
        lineId: line.lineId,
        fulfilmentQuantity: Number(line.fulfilmentQuantity),
        destinationAddress: line.destinationAddress
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const validationError = validateSelections()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const result = await createDespatchFromOrder(buildCreatePayload())
      const firstAdviceId = result.adviceIds[0]

      if (firstAdviceId) {
        navigate('/despatch/' + firstAdviceId)
        return
      }

      navigate('/despatch')
    } catch (createError) {
      setError(createError.message || 'Unable to create despatch advice.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="home-screen create-despatch-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content create-despatch-content">
        <header className="create-despatch-header">
          <div>
            <h1 className="create-despatch-title">Create Despatch Advice</h1>
            <p className="create-despatch-subtitle">Select a base order and choose fulfilment quantities per line.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/despatch" className="create-despatch-back-btn">Back to despatch</Link>
          </Button>
        </header>

        <div className="create-despatch-card">
          <form className="create-despatch-form" onSubmit={handleSubmit}>
            <section className="create-despatch-section">
              <h2 className="create-despatch-section-title">Select Base Order</h2>

              <div className="create-despatch-search-wrap" ref={searchWrapRef}>
                <div className="create-despatch-search-input-wrap">
                  <Search className="create-despatch-search-icon size-4" aria-hidden="true" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setSearchOpen(true)
                    }}
                    onFocus={handleSearchFocus}
                    placeholder="Search order ID, buyer, supplier..."
                    aria-label="Search order documents"
                  />
                </div>

                {searchOpen ? (
                  <div className="create-despatch-search-results" role="listbox" aria-label="Recent order documents">
                    {ordersLoading ? (
                      <div className="create-despatch-search-feedback">
                        <PurpleBarLoader statusLabel="Loading order options" maxWidth="220px" />
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="create-despatch-search-feedback">No matching orders found.</div>
                    ) : (
                      filteredOrders.map((order) => (
                        <button
                          key={order.uuid}
                          type="button"
                          className="create-despatch-search-option"
                          onClick={() => selectOrder(order)}
                        >
                          <span className="create-despatch-search-id">{order.displayId}</span>
                          <span>{order.buyer} / {order.supplier}</span>
                          <span className="create-despatch-search-meta">{order.issueDate}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {selectedOrder ? (
                <dl className="create-despatch-order-summary">
                  <div>
                    <dt>Order ID</dt>
                    <dd>{selectedOrder.displayId}</dd>
                  </div>
                  <div>
                    <dt>Buyer</dt>
                    <dd>{selectedOrder.buyer}</dd>
                  </div>
                  <div>
                    <dt>Supplier</dt>
                    <dd>{selectedOrder.supplier}</dd>
                  </div>
                  <div>
                    <dt>Issue Date</dt>
                    <dd>{selectedOrder.issueDate}</dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="create-despatch-section">
              <h2 className="create-despatch-section-title">Fulfilment Lines</h2>

              {detailLoading ? (
                <div className="create-despatch-detail-loading">
                  <PurpleBarLoader statusLabel="Loading order lines" maxWidth="220px" />
                </div>
              ) : !lineSelections.length ? (
                <p className="create-despatch-empty">Select an order to configure fulfilment lines.</p>
              ) : (
                <div className="create-despatch-lines">
                  {lineSelections.map((line, index) => (
                    <article key={line.lineId} className="create-despatch-line-card">
                      <div className="create-despatch-line-heading">
                        <h3>{line.lineId}</h3>
                        <p>{line.itemName}</p>
                      </div>

                      {line.description ? <p className="create-despatch-line-description">{line.description}</p> : null}

                      <div className="create-despatch-line-grid">
                        <div className="create-despatch-field">
                          <label htmlFor={'line-qty-' + line.lineId}>Fulfilment Quantity</label>
                          <Input
                            id={'line-qty-' + line.lineId}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.fulfilmentQuantity}
                            onChange={(event) => handleQuantityChange(line.lineId, event.target.value)}
                          />
                          <small>Requested: {line.requestedQuantity}</small>
                        </div>

                        <div className="create-despatch-field create-despatch-field-wide">
                          <label htmlFor={'line-address-' + line.lineId}>Destination Address</label>
                          <select
                            id={'line-address-' + line.lineId}
                            value={line.destinationKey}
                            onChange={(event) => handleDestinationChange(line.lineId, event.target.value)}
                            className="create-despatch-select"
                          >
                            {line.destinationOptions.map((option) => (
                              <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <p className="create-despatch-line-index">Line {index + 1}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {error ? <p className="create-despatch-error" role="alert">{error}</p> : null}

            <div className="create-despatch-actions">
              <Button type="submit" variant="secondary" size="sm" disabled={submitting || detailLoading || !lineSelections.length}>
                {submitting ? 'Creating Despatch Advice...' : 'Create Despatch Advice'}
              </Button>
              <Button asChild type="button" variant="ghost" size="sm" disabled={submitting}>
                <Link to="/despatch">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
