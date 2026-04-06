import { Fragment } from 'react'
import { Link } from 'react-router-dom'

const footerLinks = [
  { key: 'home', label: 'Home', to: '/', type: 'internal' },
  { key: 'support', label: 'Support', href: 'mailto:devex@platform.tcore.network', type: 'external' },
  { key: 'terms', label: 'T&Cs', to: '/terms', type: 'internal' },
  { key: 'privacy', label: 'Privacy', to: '/privacy', type: 'internal' }
]

export default function SiteFooter({ hideHome = false, className = '' }) {
  const visibleLinks = hideHome
    ? footerLinks.filter((link) => link.key !== 'home')
    : footerLinks

  const footerClassName = ['auth-footer', 'legal-footer', className].filter(Boolean).join(' ')

  return (
    <footer className={footerClassName} aria-label="Footer links">
      <Link to="/" aria-label="Go to home page">
        <img src="/img/devexlogo2.png" className="legal-footer-logo" alt="DevEx" />
      </Link>

      <div className="auth-footer-links">
        {visibleLinks.map((link, index) => (
          <Fragment key={link.key}>
            {index > 0 ? (
              <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
            ) : null}

            {link.type === 'internal' ? (
              <Link className="auth-footer-link" to={link.to}>{link.label}</Link>
            ) : (
              <a className="auth-footer-link" href={link.href}>{link.label}</a>
            )}
          </Fragment>
        ))}
      </div>

      <p className="auth-footer-copyright">© 2026 DevEx Team</p>
    </footer>
  )
}
