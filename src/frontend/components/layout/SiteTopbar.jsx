import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './styles/SiteTopbar.css'

const MENU_ANIMATION_MS = 150

const topbarMenus = [
  {
    key: 'orders',
    label: 'Orders',
    items: [
      { label: 'View Orders', to: '/order' },
      { label: 'Create Order', to: '/order/create' },
      { label: 'Upload Order', to: '/order/upload' }
    ]
  },
  {
    key: 'despatch-advice',
    label: 'Despatch Advice',
    items: [
      { label: 'View Despatch Advice', to: '/despatch' },
      { label: 'Create Despatch Advice', to: '/despatch/create' },
      { label: 'Upload Despatch Advice', to: '/despatch/upload' }
    ]
  },
  {
    key: 'invoices',
    label: 'Invoices',
    items: [
      { label: 'View Invoices', to: '/invoice' },
      { label: 'Create Invoice', to: '/invoice/create' },
      { label: 'Upload Invoice', to: '/invoice/upload' }
    ]
  }
]

function useMenuTransition(isOpen, durationMs = MENU_ANIMATION_MS) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    let hideTimer
    let frameOne
    let frameTwo

    if (isOpen) {
      setIsMounted(true)
      setIsVisible(false)

      // Two RAFs guarantee one committed hidden frame before opening.
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          setIsVisible(true)
        })
      })
    } else {
      setIsVisible(false)
      hideTimer = window.setTimeout(() => {
        setIsMounted(false)
      }, durationMs)
    }

    return () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer)
      }
      if (frameOne) {
        window.cancelAnimationFrame(frameOne)
      }
      if (frameTwo) {
        window.cancelAnimationFrame(frameTwo)
      }
    }
  }, [durationMs, isOpen])

  return { isMounted, isVisible }
}

function TopbarDropdown({ menu, isOpen, onToggle, onClose }) {
  const { isMounted, isVisible } = useMenuTransition(isOpen)

  return (
    <div className="home-nav-dropdown">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`home-nav-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>{menu.label}</span>
        <span className="home-nav-arrow" aria-hidden="true" />
      </Button>

      {isMounted ? (
        <div
          className={`home-nav-menu ${isVisible ? 'is-open' : 'is-closing'}`}
          role="menu"
          aria-label={`${menu.label} options`}
        >
          {menu.items.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="home-nav-item home-nav-item-link"
              role="menuitem"
              onClick={onClose}
            >
              <span className="home-nav-link-text">{item.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TopbarUtilityMenu({ isOpen, onToggle, onClose, onLogout }) {
  const { isMounted, isVisible } = useMenuTransition(isOpen)

  return (
    <div className="home-user-menu-wrap">
      <button
        type="button"
        className={`home-menu-button${isOpen ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open user menu"
        onClick={onToggle}
      >
        <span className="home-menu-button-line" />
        <span className="home-menu-button-line" />
        <span className="home-menu-button-line" />
      </button>

      {isMounted ? (
        <div
          className={`home-nav-menu home-user-menu ${isVisible ? 'is-open' : 'is-closing'}`}
          role="menu"
          aria-label="User actions"
        >
          <Link to="/settings" className="home-nav-item home-nav-item-link" role="menuitem" onClick={onClose}>
            <span className="home-nav-link-text">Settings</span>
          </Link>

          <button type="button" className="home-nav-item home-nav-item-button" role="menuitem" onClick={onLogout}>
            Log Out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function SiteTopbar({ firstName = 'there', onLogout }) {
  const topbarRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)

  async function handleLogoutClick() {
    setOpenMenu(null)
    if (onLogout) {
      await onLogout()
    }
  }

  useEffect(() => {
    function handleOutsidePointerDown(event) {
      if (topbarRef.current && !topbarRef.current.contains(event.target)) {
        setOpenMenu(null)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handleOutsidePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <header className="home-topbar" aria-label="Main navigation">
      <div className="home-topbar-logo-block">
        <Link to="/" aria-label="Go to home page">
          <img className="home-topbar-logo" src="/img/devexlogo.png" alt="DevEx" />
        </Link>
      </div>

      <div className="home-topbar-navband" ref={topbarRef}>
        <nav className="home-nav" aria-label="Primary navigation options">
          {topbarMenus.map((menu) => (
            <TopbarDropdown
              key={menu.key}
              menu={menu}
              isOpen={openMenu === menu.key}
              onToggle={() => setOpenMenu((current) => (current === menu.key ? null : menu.key))}
              onClose={() => setOpenMenu(null)}
            />
          ))}

          <a className="home-nav-link home-nav-link-animated" href="/api-docs">
            <span className="home-nav-link-text">API Documentation</span>
          </a>
          <a className="home-nav-link home-nav-link-animated" href="mailto:devex@platform.tcore.network">
            <span className="home-nav-link-text">Support</span>
          </a>
        </nav>

        <div className="home-topbar-tools" aria-label="User controls">
          <span className="home-topbar-greeting">Hi {firstName}!</span>

          <span className="home-avatar-display" aria-hidden="true">
            <UserRound className="size-5" aria-hidden="true" />
          </span>

          <TopbarUtilityMenu
            isOpen={openMenu === 'user-actions'}
            onToggle={() => setOpenMenu((current) => (current === 'user-actions' ? null : 'user-actions'))}
            onClose={() => setOpenMenu(null)}
            onLogout={handleLogoutClick}
          />
        </div>
      </div>
    </header>
  )
}
