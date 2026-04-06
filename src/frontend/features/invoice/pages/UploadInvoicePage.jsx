import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp, Receipt } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/UploadInvoicePage.css'

function isXmlFile(file) {
  const fileName = file?.name?.toLowerCase() || ''
  return fileName.endsWith('.xml')
}

export default function UploadInvoicePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const fileInputRef = useRef(null)

  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function updateSelectedFiles(fileList) {
    const xmlFiles = Array.from(fileList || []).filter(isXmlFile)
    setSelectedFiles(xmlFiles)
    setSubmitted(false)
  }

  function handleFileChange(event) {
    updateSelectedFiles(event.target.files)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    updateSelectedFiles(event.dataTransfer?.files)
  }

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!selectedFiles.length) {
      return
    }

    setSubmitted(true)
  }

  return (
    <main className="home-screen invoice-upload-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

      <section className="home-content invoice-upload-content">
        <header className="invoice-upload-header">
          <h1 className="invoice-upload-title">Upload Invoices</h1>
          <p className="invoice-upload-subtitle">Upload a UBL Invoice XML file for validation and downstream processing.</p>
        </header>

        <div className="invoice-upload-card">
          <form className="invoice-upload-form" onSubmit={handleSubmit}>
            <label className="invoice-upload-label" htmlFor="invoice-xml-file">Invoice XML files</label>
            <div
              className={`invoice-upload-dropzone${isDragging ? ' is-dragging' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsDragging(false)
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="invoice-xml-file"
                className="invoice-upload-input"
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                onChange={handleFileChange}
              />
              <div className="invoice-upload-drop-content">
                <Receipt className="invoice-upload-input-icon" aria-hidden="true" />
                <p className="invoice-upload-drop-prompt">
                  {isDragging ? 'Drop XML files here to add them' : 'Drag and drop one or more XML files here'}
                </p>
                <p className="invoice-upload-drop-subtext">or</p>
                <Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
                  Browse XML files
                </Button>
              </div>
            </div>

            <p className="invoice-upload-file-status" aria-live="polite">
              {selectedFiles.length
                ? `${selectedFiles.length} XML file${selectedFiles.length > 1 ? 's' : ''} selected.`
                : 'No files selected yet.'}
            </p>

            {selectedFiles.length ? (
              <ul className="invoice-upload-file-list" aria-label="Selected files">
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="invoice-upload-file-item">{file.name}</li>
                ))}
              </ul>
            ) : null}

            {submitted ? (
              <p className="invoice-upload-success" role="status">
                Draft upload complete for {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}. API integration can be connected next.
              </p>
            ) : null}

            <div className="invoice-upload-actions">
              <Button type="submit" variant="secondary" size="sm" disabled={!selectedFiles.length}>
                <FileUp className="size-4" aria-hidden="true" />
                Upload XML Files
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/invoice">Back to Invoices</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
