import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Plus, Upload, Receipt } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/InvoicePage.css'

const mockInvoices = [
  { id: 'INV-001', despatchId: 'DSP-001', buyer: 'Acme Corp', total: '$4,250.00', status: 'Issued', date: '2026-04-06' },
  { id: 'INV-002', despatchId: 'DSP-002', buyer: 'Nexus Inc', total: '$1,180.00', status: 'Paid', date: '2026-04-05' },
  { id: 'INV-003', despatchId: 'DSP-003', buyer: 'Skyline Group', total: '$9,720.00', status: 'Overdue', date: '2026-04-04' },
  { id: 'INV-004', despatchId: 'DSP-004', buyer: 'Acme Corp', total: '$640.00', status: 'Draft', date: '2026-04-03' },
  { id: 'INV-005', despatchId: 'DSP-005', buyer: 'Meridian LLC', total: '$3,310.00', status: 'Issued', date: '2026-04-01' },
]

const STATUS_CLASS = {
  Draft: 'status-draft',
  Issued: 'status-issued',
  Paid: 'status-paid',
  Overdue: 'status-overdue',
  Cancelled: 'status-cancelled',
}

export default function InvoicePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="home-screen invoice-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

      <section className="home-content invoice-content">
        <header className="invoice-header">
          <div className="invoice-heading">
            <h1 className="invoice-title">Invoices</h1>
            <p className="invoice-subtitle">View, create, or upload Invoice XML documents.</p>
          </div>
          <div className="invoice-actions">
            <Button asChild variant="outline" size="sm" className="invoice-action-btn">
              <Link to="/invoice/upload">
                <Upload className="size-4" aria-hidden="true" />
                Upload
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="invoice-action-btn invoice-action-primary">
              <Link to="/invoice/create">
                <Plus className="size-4" aria-hidden="true" />
                Create Invoice
              </Link>
            </Button>
          </div>
        </header>

        <div className="invoice-table-wrap">
          {mockInvoices.length === 0 ? (
            <div className="invoice-empty">
              <Receipt className="invoice-empty-icon" aria-hidden="true" />
              <p>No invoices yet. Create or upload one to get started.</p>
            </div>
          ) : (
            <table className="invoice-table" aria-label="Invoices list">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Despatch Ref</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {mockInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span className="invoice-id-badge">{inv.id}</span>
                    </td>
                    <td>
                      <Link to={`/despatch/${inv.despatchId}`} className="invoice-ref-link">{inv.despatchId}</Link>
                    </td>
                    <td>{inv.buyer}</td>
                    <td className="invoice-total-cell">{inv.total}</td>
                    <td>
                      <span className={`invoice-status-badge ${STATUS_CLASS[inv.status] ?? ''}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="invoice-date-cell">{inv.date}</td>
                    <td className="invoice-row-actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/invoice/${inv.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
