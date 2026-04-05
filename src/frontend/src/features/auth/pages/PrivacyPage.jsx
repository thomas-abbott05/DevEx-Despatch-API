import './styles/LegalPage.css'
import { Link } from 'react-router-dom'

const sections = [
  {
    heading: '1. Information We Collect',
    paragraphs: [
      'We may collect account details, operational metadata, and activity logs needed to authenticate users, monitor service health, and support document processing workflows.',
      'Please delete your account using the settings page, or email us using the support address in the footer.'
    ]
  },
  {
    heading: '2. How We Use Information',
    paragraphs: [
      'Collected information is used to provide core functionality, improve reliability, deliver support, and protect system integrity. We process data only for legitimate operational and security purposes.',
      'Data may also be used for analytics in aggregated or anonymised form to understand usage patterns and improve user experience over time.'
    ]
  },
  {
    heading: '3. Data Storage And Retention',
    paragraphs: [
      'Information is stored using technical and organisational safeguards designed to reduce unauthorised access risks. We hash all passwords, and have automated protections for credentials and brute force attacks, and we use enterprise grade database hosting.',
      'Where possible, outdated data is removed or archived according to documented retention schedules agreed with your organisation.'
    ]
  },
  {
    heading: '4. Sharing And Disclosure',
    paragraphs: [
      'We do not sell personal information. Data may be shared with trusted service providers where required to operate the platform, subject to confidentiality and security obligations.',
      'Information may also be disclosed where required by law, regulation, or lawful request from an authorised authority.'
    ]
  },
  {
    heading: '5. User Rights',
    paragraphs: [
      'Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict processing of personal information associated with your account.',
      'Requests relating to privacy rights can be submitted through your organisation administrator or by contacting support.'
    ]
  },
  {
    heading: '6. Policy Updates',
    paragraphs: [
      'This policy may be updated to reflect changes in legal requirements, product capabilities, or operational practices. The latest version will always be published on this page.',
      'By using our service, you agree to the terms of this Privacy Policy. If you do not agree with any part of this policy, please discontinue use of the platform.'
    ]
  }
]

export default function PrivacyPage() {
  return (
    <main className="legal-screen legal-page">
      <header className="legal-topbar" aria-label="Site header">
        <Link to="/" aria-label="Go to home page">
          <img className="legal-topbar-logo" src="/img/devexlogo.png" alt="DevEx" />
        </Link>
      </header>

      <section className="legal-content" aria-label="Privacy Policy">
        <header className="legal-header">
          <h1>Privacy Policy</h1>
          <p>By using the DevEx UBL platform, you are agreeing to the terms of this Privacy Policy.</p>
        </header>

        <article className="legal-body">
          {sections.map((section) => (
            <section key={section.heading} className="legal-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
        <footer className="auth-footer legal-footer" aria-label="Footer links">
          <Link to="/" aria-label="Go to home page">
            <img src="/img/devexlogo2.png" className="legal-footer-logo" alt="DevEx" />
          </Link>
          <div className="auth-footer-links">
            <a className="auth-footer-link" href="/">Home</a>
            <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
            <a className="auth-footer-link" href="mailto:devex@platform.tcore.network">Support</a>
            <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
            <a className="auth-footer-link" href="/terms">T&amp;Cs</a>
            <span className="auth-footer-dot" aria-hidden="true">&bull;</span>
            <a className="auth-footer-link" href="/privacy">Privacy</a>
          </div>
          <p className="auth-footer-copyright">© 2026 DevEx Team</p>
        </footer>
      </section>
    </main>
  )
}
