import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { createOrderDocument, fetchNextOrderDisplayId } from '../api/orders-api'
import './styles/CreateOrderPage.css'

let nextLineKey = 1

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function createInitialLine(index) {
  return {
    key: 'line-' + nextLineKey++,
    lineId: 'LINE-' + index,
    quantity: '1',
    unitPrice: '1',
    itemName: '',
    description: '',
    streetName: '',
    cityName: '',
    postalZone: '',
    countryCode: 'AU',
    useBuyerAddress: false
  }
}

function getLineNumber(lineId) {
  const match = String(lineId).trim().match(/^LINE-(\d+)$/i)

  return match ? Number(match[1]) : 0
}

function getNextLineIndex(lineItems) {
  return lineItems.reduce((highestLineNumber, lineItem) => Math.max(highestLineNumber, getLineNumber(lineItem.lineId)), 0) + 1
}

function getLineDeliveryAddress(lineItem, buyerAddress) {
  if (lineItem.useBuyerAddress) {
    return buyerAddress
  }

  return {
    streetName: lineItem.streetName,
    cityName: lineItem.cityName,
    postalZone: lineItem.postalZone,
    countryCode: lineItem.countryCode
  }
}

export default function CreateOrderPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [orderId, setOrderId] = useState('')
  const [issueDate, setIssueDate] = useState(todayIsoDate)
  const [buyerName, setBuyerName] = useState('')
  const [buyerStreetName, setBuyerStreetName] = useState('')
  const [buyerCityName, setBuyerCityName] = useState('')
  const [buyerPostalZone, setBuyerPostalZone] = useState('')
  const [buyerCountryCode, setBuyerCountryCode] = useState('AU')
  const [supplierName, setSupplierName] = useState('')
  const [supplierStreetName, setSupplierStreetName] = useState('')
  const [supplierCityName, setSupplierCityName] = useState('')
  const [supplierPostalZone, setSupplierPostalZone] = useState('')
  const [supplierCountryCode, setSupplierCountryCode] = useState('AU')
  const [sellerPartyId, setSellerPartyId] = useState('')
  const [supplierAbn, setSupplierAbn] = useState('')
  const [customerAbn, setCustomerAbn] = useState('')
  const [lineItems, setLineItems] = useState([createInitialLine(1)])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    async function prefillOrderId() {
      try {
        const nextOrderDisplayId = await fetchNextOrderDisplayId()
        if (isActive) {
          setOrderId((currentId) => (currentId.trim() ? currentId : nextOrderDisplayId))
        }
      } catch (_loadError) {
        // Ignore prefill failures so manual entry always remains available.
      }
    }

    prefillOrderId()

    return () => {
      isActive = false
    }
  }, [])

  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Orders', to: '/order' },
    { label: 'Create Order' }
  ]

  const canSubmit = useMemo(() => !submitting && lineItems.length > 0, [lineItems.length, submitting])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function updateLineItem(lineKey, field, value) {
    setLineItems((currentItems) =>
      currentItems.map((item) =>
        item.key === lineKey
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    )
  }

  function addLineItem() {
    setLineItems((currentItems) => [...currentItems, createInitialLine(getNextLineIndex(currentItems))])
  }

  function removeLineItem(lineKey) {
    setLineItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems
      }

      return currentItems.filter((item) => item.key !== lineKey)
    })
  }

  function validateForm() {
    if (!orderId.trim()) {
      return 'Order ID is required.'
    }
    if (!issueDate.trim()) {
      return 'Issue date is required.'
    }
    if (!buyerName.trim()) {
      return 'Buyer name is required.'
    }
    if (!buyerStreetName.trim() || !buyerCityName.trim() || !buyerPostalZone.trim() || !buyerCountryCode.trim()) {
      return 'Buyer postal address (street, city, postal zone, country) is required.'
    }
    if (!supplierName.trim()) {
      return 'Supplier name is required.'
    }
    if (!supplierStreetName.trim() || !supplierCityName.trim() || !supplierPostalZone.trim() || !supplierCountryCode.trim()) {
      return 'Supplier postal address (street, city, postal zone, country) is required.'
    }
    for (let index = 0; index < lineItems.length; index += 1) {
      const line = lineItems[index]
      const lineLabel = 'Line ' + String(index + 1)

      if (!line.lineId.trim()) {
        return lineLabel + ': Line ID is required.'
      }

      const quantity = Number(line.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return lineLabel + ': Quantity must be greater than 0.'
      }

      const unitPrice = Number(line.unitPrice)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return lineLabel + ': Price per unit must be greater than 0.'
      }

      if (!line.itemName.trim()) {
        return lineLabel + ': Item name is required.'
      }
      if (!line.description.trim()) {
        return lineLabel + ': Item description is required.'
      }
      const deliveryAddress = getLineDeliveryAddress(line, {
        streetName: buyerStreetName.trim(),
        cityName: buyerCityName.trim(),
        postalZone: buyerPostalZone.trim(),
        countryCode: buyerCountryCode.trim().toUpperCase()
      })

      if (!deliveryAddress.streetName.trim() || !deliveryAddress.cityName.trim() || !deliveryAddress.postalZone.trim() || !deliveryAddress.countryCode.trim()) {
        return lineLabel + ': Delivery street, city, postal zone, and country are required.'
      }
    }

    return ''
  }

  function buildCreatePayload() {
    const buyerAddress = {
      streetName: buyerStreetName.trim(),
      cityName: buyerCityName.trim(),
      postalZone: buyerPostalZone.trim(),
      countryCode: buyerCountryCode.trim().toUpperCase()
    }

    return {
      sellerPartyId: sellerPartyId.trim(),
      supplierAbn: supplierAbn.trim(),
      customerAbn: customerAbn.trim(),
      data: {
        ID: orderId.trim(),
        IssueDate: issueDate,
        BuyerCustomerParty: {
          Party: {
            PartyName: [
              {
                Name: buyerName.trim()
              }
            ],
            PostalAddress: {
              StreetName: buyerStreetName.trim(),
              CityName: buyerCityName.trim(),
              PostalZone: buyerPostalZone.trim(),
              Country: {
                IdentificationCode: buyerCountryCode.trim().toUpperCase()
              }
            }
          }
        },
        SellerSupplierParty: {
          Party: {
            PartyName: [
              {
                Name: supplierName.trim()
              }
            ],
            PostalAddress: {
              StreetName: supplierStreetName.trim(),
              CityName: supplierCityName.trim(),
              PostalZone: supplierPostalZone.trim(),
              Country: {
                IdentificationCode: supplierCountryCode.trim().toUpperCase()
              }
            }
          }
        },
        OrderLine: lineItems.map((line) => {
          const deliveryAddress = getLineDeliveryAddress(line, buyerAddress)

          return {
            LineItem: {
              ID: line.lineId.trim(),
              Quantity: Number(line.quantity),
              Price: {
                PriceAmount: Number(line.unitPrice)
              },
              Delivery: {
                DeliveryAddress: {
                  StreetName: deliveryAddress.streetName.trim(),
                  CityName: deliveryAddress.cityName.trim(),
                  PostalZone: deliveryAddress.postalZone.trim(),
                  Country: {
                    IdentificationCode: deliveryAddress.countryCode.trim().toUpperCase()
                  }
                }
              },
              Item: {
                Description: [line.description.trim()],
                Name: line.itemName.trim()
              }
            }
          }
        })
      }
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
      const createdOrder = await createOrderDocument(buildCreatePayload())
      if (createdOrder?.uuid) {
        navigate('/order/' + createdOrder.uuid)
        return
      }

      navigate('/order')
    } catch (createError) {
      setError(createError.message || 'Unable to create order document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="home-screen create-order-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content create-order-content">
        <header className="create-order-header">
          <div>
            <h1 className="create-order-title">Create Order</h1>
            <p className="create-order-subtitle">Enter order details to generate Order XML and save it to your account.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="create-order-nav-btn">
            <Link to="/order">Back to orders</Link>
          </Button>
        </header>

        <div className="create-order-card">
          <form className="create-order-form" onSubmit={handleSubmit}>
            <section className="create-order-section">
              <h2 className="create-order-section-title">Order Details</h2>
              <div className="create-order-grid create-order-grid-two">
                <div className="create-order-field">
                  <Label htmlFor="order-id">Order ID</Label>
                  <Input id="order-id" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="ORD-001" />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="issue-date">Issue Date</Label>
                  <Input id="issue-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                </div>
              </div>
            </section>

            <section className="create-order-section">
              <h2 className="create-order-section-title">Parties</h2>
              <div className="create-order-grid create-order-grid-two">
                <div className="create-order-field">
                  <Label htmlFor="buyer-name">Buyer Name</Label>
                  <Input id="buyer-name" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Buyer Name" />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="buyer-street">Buyer Street</Label>
                  <Input
                    id="buyer-street"
                    value={buyerStreetName}
                    onChange={(event) => setBuyerStreetName(event.target.value)}
                    placeholder="123 Buyer St"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="buyer-city">Buyer City</Label>
                  <Input
                    id="buyer-city"
                    value={buyerCityName}
                    onChange={(event) => setBuyerCityName(event.target.value)}
                    placeholder="Sydney"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="buyer-postal">Buyer Postal Zone</Label>
                  <Input
                    id="buyer-postal"
                    value={buyerPostalZone}
                    onChange={(event) => setBuyerPostalZone(event.target.value)}
                    placeholder="2000"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="buyer-country">Buyer Country Code</Label>
                  <Input
                    id="buyer-country"
                    value={buyerCountryCode}
                    onChange={(event) => setBuyerCountryCode(event.target.value)}
                    placeholder="AU"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-name">Supplier Name</Label>
                  <Input id="supplier-name" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Supplier Name" />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-street">Supplier Street</Label>
                  <Input
                    id="supplier-street"
                    value={supplierStreetName}
                    onChange={(event) => setSupplierStreetName(event.target.value)}
                    placeholder="456 Supplier Ave"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-city">Supplier City</Label>
                  <Input
                    id="supplier-city"
                    value={supplierCityName}
                    onChange={(event) => setSupplierCityName(event.target.value)}
                    placeholder="Melbourne"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-postal">Supplier Postal Zone</Label>
                  <Input
                    id="supplier-postal"
                    value={supplierPostalZone}
                    onChange={(event) => setSupplierPostalZone(event.target.value)}
                    placeholder="3000"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-country">Supplier Country Code</Label>
                  <Input
                    id="supplier-country"
                    value={supplierCountryCode}
                    onChange={(event) => setSupplierCountryCode(event.target.value)}
                    placeholder="AU"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="seller-party-id">Seller Party ID (optional)</Label>
                  <Input
                    id="seller-party-id"
                    value={sellerPartyId}
                    onChange={(event) => setSellerPartyId(event.target.value)}
                    placeholder="Leave blank to create without party link"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="supplier-abn">Supplier ABN (for invoices)</Label>
                  <Input
                    id="supplier-abn"
                    value={supplierAbn}
                    onChange={(event) => setSupplierAbn(event.target.value)}
                    placeholder="12345678987"
                  />
                </div>
                <div className="create-order-field">
                  <Label htmlFor="customer-abn">Customer ABN (optional)</Label>
                  <Input
                    id="customer-abn"
                    value={customerAbn}
                    onChange={(event) => setCustomerAbn(event.target.value)}
                    placeholder="12345678987"
                  />
                </div>
              </div>
            </section>

            <section className="create-order-section">
              <div className="create-order-line-header">
                <h2 className="create-order-section-title">Order Lines</h2>
              </div>

              <div className="create-order-lines">
                {lineItems.map((line, index) => (
                  <article key={line.key} className="create-order-line-card">
                    <div className="create-order-line-card-header">
                      <h3>Line {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="create-order-remove-line"
                        onClick={() => removeLineItem(line.key)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>

                    <div className="create-order-grid create-order-grid-two">
                      <div className="create-order-field">
                        <Label htmlFor={'line-id-' + line.key}>Line ID</Label>
                        <Input
                          id={'line-id-' + line.key}
                          value={line.lineId}
                          onChange={(event) => updateLineItem(line.key, 'lineId', event.target.value)}
                          placeholder="LINE-1"
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-qty-' + line.key}>Quantity</Label>
                        <Input
                          id={'line-qty-' + line.key}
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(event) => updateLineItem(line.key, 'quantity', event.target.value)}
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-unit-price-' + line.key}>Price per unit</Label>
                        <Input
                          id={'line-unit-price-' + line.key}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) => updateLineItem(line.key, 'unitPrice', event.target.value)}
                          placeholder="10.00"
                        />
                      </div>
                      <div className="create-order-field create-order-field-full create-order-line-toggle-wrap">
                        <label className="create-order-line-toggle" htmlFor={'line-use-buyer-address-' + line.key}>
                          <input
                            id={'line-use-buyer-address-' + line.key}
                            type="checkbox"
                            checked={line.useBuyerAddress}
                            onChange={(event) => updateLineItem(line.key, 'useBuyerAddress', event.target.checked)}
                          />
                          <span>
                            <strong>Same as Buyer Address</strong>
                            <small>Use the buyer postal address for this line&apos;s delivery address.</small>
                          </span>
                        </label>
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-name-' + line.key}>Item Name</Label>
                        <Input
                          id={'line-name-' + line.key}
                          value={line.itemName}
                          onChange={(event) => updateLineItem(line.key, 'itemName', event.target.value)}
                          placeholder="Product Name"
                        />
                      </div>
                      <div className="create-order-field create-order-field-full">
                        <Label htmlFor={'line-description-' + line.key}>Item Description</Label>
                        <Input
                          id={'line-description-' + line.key}
                          value={line.description}
                          onChange={(event) => updateLineItem(line.key, 'description', event.target.value)}
                          placeholder="Item Description"
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-street-' + line.key}>Delivery Street</Label>
                        <Input
                          id={'line-street-' + line.key}
                          value={line.useBuyerAddress ? buyerStreetName : line.streetName}
                          onChange={(event) => updateLineItem(line.key, 'streetName', event.target.value)}
                          placeholder="123 Buyer St"
                          disabled={line.useBuyerAddress}
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-city-' + line.key}>Delivery City</Label>
                        <Input
                          id={'line-city-' + line.key}
                          value={line.useBuyerAddress ? buyerCityName : line.cityName}
                          onChange={(event) => updateLineItem(line.key, 'cityName', event.target.value)}
                          placeholder="Sydney"
                          disabled={line.useBuyerAddress}
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-postal-' + line.key}>Delivery Postal Zone</Label>
                        <Input
                          id={'line-postal-' + line.key}
                          value={line.useBuyerAddress ? buyerPostalZone : line.postalZone}
                          onChange={(event) => updateLineItem(line.key, 'postalZone', event.target.value)}
                          placeholder="2000"
                          disabled={line.useBuyerAddress}
                        />
                      </div>
                      <div className="create-order-field">
                        <Label htmlFor={'line-country-' + line.key}>Delivery Country Code</Label>
                        <Input
                          id={'line-country-' + line.key}
                          value={line.useBuyerAddress ? buyerCountryCode : line.countryCode}
                          onChange={(event) => updateLineItem(line.key, 'countryCode', event.target.value)}
                          placeholder="AU"
                          disabled={line.useBuyerAddress}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="create-order-add-line-wrap">
                <Button type="button" variant="outline" size="sm" className="create-order-add-line-btn" onClick={addLineItem}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Line
                </Button>
              </div>
            </section>

            {error ? (
              <p className="create-order-error" role="alert">{error}</p>
            ) : null}

            <div className="create-order-actions">
              <Button type="submit" variant="ghost" size="sm" className="create-order-submit-btn" disabled={!canSubmit}>
                {submitting ? 'Creating Order...' : 'Create Order'}
              </Button>
              <Button asChild type="button" variant="ghost" size="sm" className="create-order-cancel-btn" disabled={submitting}>
                <Link to="/order">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
