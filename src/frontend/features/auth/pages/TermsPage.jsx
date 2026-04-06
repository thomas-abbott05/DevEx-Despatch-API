import './styles/AuthShared.css'
import { Link } from 'react-router-dom'
import SiteFooter from '@/components/layout/SiteFooter'

const sections = [
  {
    heading: '1. Acceptance Of Terms',
    paragraphs: [
      'By accessing or using this platform, you agree to follow these Terms and Conditions. If you do not agree with any part of these terms, you should discontinue use of the service.',
      'These terms apply to all visitors, users, and others who interact with the application, including any associated APIs or documentation made available through the platform.'
    ]
  },
  {
    heading: '2. Account Responsibilities',
    paragraphs: [
      'You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Please reset your password if you believe your account was compromised using the link on the login page.',
      'You agree to provide accurate account details and keep your information up to date so we can provide notices, security updates, and service communications when needed.'
    ]
  },
  {
    heading: '3. Acceptable Use',
    paragraphs: [
      'You must use the service in accordance with applicable laws and internal organisational policies. Misuse of system resources, abuse of endpoints, or attempts to bypass security controls are strictly prohibited.',
      'We may suspend or restrict access where activity is considered harmful to the platform, users, or supporting infrastructure, including repeated violations of these terms.'
    ]
  },
  {
    heading: '4. Service Availability',
    paragraphs: [
      'We aim to provide a reliable service but cannot guarantee uninterrupted availability at all times. Planned maintenance, emergency changes, and third-party dependencies may affect access temporarily.',
      'Where practical, we will provide notice for major interruptions and work to restore service as quickly as possible.'
    ]
  },
  {
    heading: '5. Intellectual Property',
    paragraphs: [
      'All branding, software, and supporting materials remain the property of their respective owners unless explicitly stated otherwise. These terms do not grant rights to reproduce or redistribute protected content.',
      'We do not claim ownership of any documents or data you upload to the platform, but you grant us a license to use that content for the purpose of providing and improving our services, subject to our Privacy Policy.',
      'We DO NOT represent NOR BEAR ANY ASSOCIATION WITH FedEx. They copied our branding and colours in their logo, but in our eternal benevolence we did not send the DevEx legal team after them. You are welcome.'
    ]
  },
  {
    heading: '6. Contact And Support',
    paragraphs: [
      'For questions about these terms, account status, or support requests, please contact the DevEx team using the support details listed in the footer below.'
    ]
  }
]

export default function TermsPage() {
  return (
    <main className="legal-screen legal-page">
      <header className="legal-topbar" aria-label="Site header">
        <Link to="/" aria-label="Go to home page">
          <img className="legal-topbar-logo" src="/img/devexlogo.png" alt="DevEx" />
        </Link>
      </header>

      <section className="legal-content" aria-label="Terms and Conditions">
        <header className="legal-header">
          <h1>Terms &amp; Conditions</h1>
          <p>By using the DevEx UBL platform, you are agreeing to the terms of this Agreement.</p>
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

        <SiteFooter />
      </section>
    </main>
  )
}
