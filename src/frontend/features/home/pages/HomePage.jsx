import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, FileText, Receipt, Truck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/HomePage.css'

const subtitleOptions = [
  "Let's get started :D",
  'Ready to get stuff done?? WOOOOOOOOO YEAHHHHHHH',
  'LET\'S GET READY TO RUMBLEEEEEEE!!!!!!',
  'Ducks: in a row. Ordered. Immaculate. Like your XML documents.'
]

const railData = {
  orders: [
    { id: 'ord-001', summary: 'Recently modified', updated: '8 minutes ago' },
    { id: 'ord-002', summary: 'Created today', updated: '26 minutes ago' },
    { id: 'ord-003', summary: 'Cancelled - order cancellation', updated: '39 minutes ago' },
    { id: 'ord-004', summary: 'Shipped', updated: '1 hour ago' },
    { id: 'ord-005', summary: 'Order changed', updated: '2 hours ago' },
    { id: 'ord-006', summary: 'Draft created', updated: '3 hours ago' }
  ],
  despatchAdvice: [
    { id: 'dsp-001', summary: 'Receipt Status changed', updated: '11 minutes ago' },
    { id: 'dsp-002', summary: 'Recently created', updated: '31 minutes ago' },
    { id: 'dsp-003', summary: 'Cancelled - fulfilment issue', updated: '55 minutes ago' },
    { id: 'dsp-004', summary: 'Fulfilled', updated: '1 hour ago' },
    { id: 'dsp-005', summary: 'Partially fulfilled', updated: '2 hours ago' },
    { id: 'dsp-006', summary: 'Awaiting receipt', updated: '4 hours ago' }
  ],
  invoices: [
    { id: 'inv-001', summary: 'Recently updated', updated: '14 minutes ago' },
    { id: 'inv-002', summary: 'Draft finalized', updated: '41 minutes ago' },
    { id: 'inv-003', summary: 'Payment terms changed', updated: '58 minutes ago' },
    { id: 'inv-004', summary: 'Amount adjusted', updated: '1 hour ago' },
    { id: 'inv-005', summary: 'Reference updated', updated: '2 hours ago' },
    { id: 'inv-006', summary: 'Ready for export', updated: '5 hours ago' }
  ]
}

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

function ActivityRail({ title, subtitle, viewAllTo, items, Icon, documentType }) {
  const viewportRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(items.length > 0)

  const updateScrollControls = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setCanScrollLeft(viewport.scrollLeft > 2)
    setCanScrollRight(viewport.scrollLeft < maxScrollLeft - 2)
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

    const firstCard = viewport.querySelector('.home-rail-card')
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : viewport.clientWidth * 0.85
    const step = cardWidth + 14

    viewport.scrollBy({
      left: direction === 'left' ? -step : step,
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
        <div className="home-rail-viewport" ref={viewportRef}>
          <div className="home-rail-track">
            {items.map((item) => (
              <Card key={item.id} className="home-rail-card" size="sm">
                <CardContent className="home-rail-card-content">
                  <div className="home-rail-card-icon-wrap" aria-hidden="true">
                    <Icon className="home-rail-card-icon" />
                  </div>

                  <div className="home-rail-card-body">
                    <div className="home-rail-card-title-row">
                      <h3 className="home-rail-card-title">{documentType}</h3>
                      <p className="home-rail-card-id">{item.id.toUpperCase()}</p>
                    </div>
                    <p className="home-rail-card-summary">{item.summary}</p>
                    <p className="home-rail-card-updated">Updated {item.updated}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

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
            title="Orders"
            subtitle="View, create or upload existing Order XML documents, or create Despatch Advice/Invoices from them."
            viewAllTo="/order"
            items={railData.orders}
            Icon={railIcons.orders}
            documentType="Order"
          />
          <ActivityRail
            title="Despatch Advice"
            subtitle="View, create, delete or upload existing Despatch Advice XML documents, or create Invoices from them."
            viewAllTo="/despatch"
            items={railData.despatchAdvice}
            Icon={railIcons.despatchAdvice}
            documentType="Despatch Advice"
          />
          <ActivityRail
            title="Invoices"
            subtitle="View existing invoices, or upload/create new ones from existing XML/Despatch Advice."
            viewAllTo="/invoice"
            items={railData.invoices}
            Icon={railIcons.invoices}
            documentType="Invoice"
          />
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
