import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, FileText, Hash, Receipt, Truck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PurpleBarLoader from '@/components/ui/PurpleBarLoader'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import { fetchHomeSummary } from '../api/home-api'
import './styles/HomePage.css'

const subtitleOptions = [
  "Let's get started :D",
  'Ready to get stuff done?? WOOOOOOOOO YEAHHHHHHH',
  'LET\'S GET READY TO RUMBLEEEEEEE!!!!!!',
  'Ducks: in a row. Ordered. Immaculate. Like your XML documents.'
]

const railIcons = {
  orders: FileText,
  despatchAdvice: Truck,
  invoices: Receipt
}

function resolveGreetingByHour() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function ActivityRail({
  title,
  subtitle,
  viewAllTo,
  detailBaseTo,
  items,
  Icon,
  documentType,
  loading,
  error,
  onRetry,
  emptyMessage,
  emptyCtaTo,
  emptyCtaLabel,
  resolveCardId,
  resolveMetaText
}) {
  const viewportRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const SCROLL_EDGE_TOLERANCE = 8

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setCanScrollLeft(false)
    setCanScrollRight(maxScrollLeft > SCROLL_EDGE_TOLERANCE)
  }, [items.length])

  const updateScrollControls = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setCanScrollLeft(viewport.scrollLeft > SCROLL_EDGE_TOLERANCE)
    setCanScrollRight(viewport.scrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return undefined
    }

    updateScrollControls()

    const onScroll = () => {
      updateScrollControls()
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onScroll)
      resizeObserver.observe(viewport)
    }

    return () => {
      viewport.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [updateScrollControls])

  function scrollRail(direction) {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const firstCard = viewport.querySelector('.home-rail-card-link')
    const track = viewport.querySelector('.home-rail-track')
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : viewport.clientWidth * 0.85
    const trackStyles = track ? window.getComputedStyle(track) : null
    const railGap = trackStyles ? Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0') || 0 : 0
    const step = cardWidth + railGap
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const delta = direction === 'left' ? -step : step
    const targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, viewport.scrollLeft + delta))

    setCanScrollLeft(targetScrollLeft > SCROLL_EDGE_TOLERANCE)
    setCanScrollRight(targetScrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE)

    viewport.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    })
  }

  return (
    <section className="home-rail-section" aria-label={`${title} recent activity`}>
      <header className="home-rail-header">
        <div className="home-rail-heading">
          <h2 className="home-rail-title">{title}</h2>
          {subtitle ? <p className="home-rail-subtitle">{subtitle}</p> : null}
        </div>

        <div className="home-rail-header-actions">
          <div className="home-rail-controls" aria-label={`${title} carousel controls`}>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="home-rail-control"
              onClick={() => scrollRail('left')}
              disabled={!canScrollLeft}
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="home-rail-control"
              onClick={() => scrollRail('right')}
              disabled={!canScrollRight}
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <Button asChild variant="ghost" size="sm" className="home-view-all">
            <Link className={'home-nav-item-link'} to={viewAllTo}>
              View All
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="home-rail-shell">
        {loading ? (
          <div className="home-rail-feedback">
            <PurpleBarLoader statusLabel={`Loading ${title.toLowerCase()}`} maxWidth="280px" />
          </div>
        ) : error ? (
          <div className="home-rail-feedback home-rail-feedback-error">
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
          </div>
        ) : (
          <div className="home-rail-viewport" ref={viewportRef}>
            {items.length === 0 ? (
              <div className="home-rail-empty-state">
                <p className="home-rail-empty-text">{emptyMessage || `No ${title.toLowerCase()} available yet.`}</p>
                {emptyCtaTo && emptyCtaLabel ? (
                  <p className="home-rail-empty-subtitle">
                    Create one to get started:
                    <Link className="auth-footer-link home-rail-empty-link" to={emptyCtaTo}>
                      <span>{emptyCtaLabel}</span>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className={`home-rail-track${items.length === 0 ? ' home-rail-track-empty' : ''}`}>
              {items.map((item) => {
                const cardId = typeof resolveCardId === 'function' ? resolveCardId(item) : item.displayId
                const metaText = typeof resolveMetaText === 'function' ? resolveMetaText(item) : ''
                const buyerName = item.buyer || 'Unknown Buyer'
                const issuedText = `Issued ${item.issueDate || 'Unknown date'} for ${buyerName}`

                return (
                  <Link key={item.uuid} className="home-rail-card-link" to={`${detailBaseTo}/${item.uuid}`}>
                    <Card className="home-rail-card" size="sm">
                      <CardContent className="home-rail-card-content">
                        <div className="home-rail-card-icon-wrap" aria-hidden="true">
                          <Icon className="home-rail-card-icon" />
                        </div>

                        <div className="home-rail-card-body">
                          <div className="home-rail-card-title-row">
                            <h3 className="home-rail-card-title">{documentType}</h3>
                            <p className="home-rail-card-id">
                              <Hash className="home-rail-card-id-icon" aria-hidden="true" />
                              <span title={cardId || item.displayId}>{cardId || item.displayId}</span>
                            </p>
                          </div>
                          <p className="home-rail-card-summary">{item.status}</p>
                          <p className="home-rail-card-updated" title={issuedText}>{issuedText}</p>
                          {metaText ? (
                            <p className="home-rail-card-meta-subtle">{metaText}</p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}

              {items.length > 0 ? (
                <Link className="home-rail-card-link" to={viewAllTo}>
                  <Card className="home-rail-card home-rail-card-view-all" size="sm">
                    <CardContent className="home-rail-card-content home-rail-card-view-all-content">
                      <p className="home-rail-card-view-all-text">View All</p>
                      <ArrowRight className="size-5" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [homeData, setHomeData] = useState({ orders: [], despatch: [], invoices: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const greeting = useMemo(() => resolveGreetingByHour(), [])
  const subtitle = useMemo(
    () => subtitleOptions[Math.floor(Math.random() * subtitleOptions.length)],
    []
  )
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const loadHomeSummary = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await fetchHomeSummary()
      setHomeData(payload)
    } catch (loadError) {
      setHomeData({ orders: [], despatch: [], invoices: [] })
      setError(loadError.message || 'Unable to load document summary.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHomeSummary()
  }, [loadHomeSummary])

  return (
    <main className="home-screen home-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

      <section className="home-content">
        <header className="home-greeting" aria-label="Welcome message">
          <h1>{greeting}, {firstName}</h1>
          <p className="home-greeting-subtitle">{subtitle}</p>
        </header>

        <div className="home-rails">
          <ActivityRail
            title="Recent Orders"
            subtitle="View, create or upload existing Order XML documents, or create Despatch Advice/Invoices from them."
            viewAllTo="/order"
            detailBaseTo="/order"
            items={homeData.orders}
            Icon={railIcons.orders}
            documentType="Order"
            loading={loading}
            error={error}
            onRetry={loadHomeSummary}
            emptyMessage="Nothing here, yet!"
            emptyCtaTo="/order/create"
            emptyCtaLabel="Create Order"
          />
          <ActivityRail
            title="Recent Despatch Advice"
            subtitle="View, create, delete or upload existing Despatch Advice XML documents, or create Invoices from them."
            viewAllTo="/despatch"
            detailBaseTo="/despatch"
            items={homeData.despatch}
            Icon={railIcons.despatchAdvice}
            documentType="Despatch Advice"
            loading={loading}
            error={error}
            onRetry={loadHomeSummary}
            resolveCardId={(item) => item.uuid}
            resolveMetaText={(item) => `Order: ${item.orderDisplayId || item.displayId || 'Unknown'}`}
            emptyMessage="Nothing here, yet!"
            emptyCtaTo="/despatch/create"
            emptyCtaLabel="Create Despatch Advice"
          />
          <ActivityRail
            title="Recent Invoices"
            subtitle="View existing invoices, or upload/create new ones from existing XML/Despatch Advice."
            viewAllTo="/invoice"
            detailBaseTo="/invoice"
            items={homeData.invoices}
            Icon={railIcons.invoices}
            documentType="Invoice"
            loading={loading}
            error={error}
            onRetry={loadHomeSummary}
            emptyMessage="Nothing here, yet!"
            emptyCtaTo="/invoice/create"
            emptyCtaLabel="Create Invoice"
          />
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
