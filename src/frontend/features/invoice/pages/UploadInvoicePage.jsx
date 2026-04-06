import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp, Receipt, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/UploadInvoicePage.css'

function isXmlFile(file) {
  const fileName = file?.name?.toLowerCase() || ''
  return fileName.endsWith('.xml')
}

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export default function UploadInvoicePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const fileInputRef = useRef(null)
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Invoices', to: '/invoice' },
    { label: 'Upload Invoice' },
  ]

  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function updateSelectedFiles(fileList) {
    const xmlFiles = Array.from(fileList || []).filter(isXmlFile)
    setSelectedFiles((currentFiles) => {
      const seenFiles = new Set(currentFiles.map(getFileKey))
      const nextFiles = [...currentFiles]

      xmlFiles.forEach((file) => {
        const fileKey = getFileKey(file)

        if (!seenFiles.has(fileKey)) {
          seenFiles.add(fileKey)
          nextFiles.push(file)
        }
      })

      return nextFiles
    })
    setSubmitted(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeSelectedFile(fileToRemove) {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter(
        (file) => file.name !== fileToRemove.name || file.lastModified !== fileToRemove.lastModified,
      ),
    )
    setSubmitted(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content invoice-upload-content">
        <header className="invoice-upload-header">
          <h1 className="invoice-upload-title">Upload Invoices</h1>
          <p className="invoice-upload-subtitle">Upload UBL Invoice XML files for safekeeping or to match with existing orders.</p>
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
                <Button type="button" className="file-picker-button" size="sm" onClick={openFilePicker}>
                  Add files from your device
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
                  <li key={`${file.name}-${file.lastModified}`} className="invoice-upload-file-item">
                    <span className="invoice-upload-file-name">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="invoice-upload-file-remove"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeSelectedFile(file)}
                    >
                      <Trash2 className="invoice-upload-file-remove-icon" aria-hidden="true" />
                      <span className="invoice-upload-file-remove-text">Remove file</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {submitted ? (
              <p className="invoice-upload-success" role="status">
                Draft upload complete for {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}. API integration can be connected next.
              </p>
            ) : null}

            <div className="invoice-upload-actions">
              <Button type="submit" variant="ghost" className="upload-confirm-btn" size="sm" disabled={!selectedFiles.length}>
                <FileUp className="upload-confirm-icon" aria-hidden="true" />
                Upload XML Files
              </Button>
              <Button asChild type="button" variant="ghost" className="upload-cancel-btn" size="sm">
                <Link to="/invoice">Cancel upload</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
