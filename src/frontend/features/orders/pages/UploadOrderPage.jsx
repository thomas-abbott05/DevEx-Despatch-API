import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp, FileText } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/UploadOrderPage.css'

function isXmlFile(file) {
  const fileName = file?.name?.toLowerCase() || ''
  return fileName.endsWith('.xml')
}

export default function UploadOrderPage() {
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
    <main className="home-screen order-upload-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} />

      <section className="home-content order-upload-content">
        <header className="order-upload-header">
          <h1 className="order-upload-title">Upload Orders</h1>
          <p className="order-upload-subtitle">Upload a UBL Order XML file to begin processing.</p>
        </header>

        <div className="order-upload-card">
          <form className="order-upload-form" onSubmit={handleSubmit}>
            <label className="order-upload-label" htmlFor="order-xml-file">Order XML files</label>
            <div
              className={`order-upload-dropzone${isDragging ? ' is-dragging' : ''}`}
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
                id="order-xml-file"
                className="order-upload-input"
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                onChange={handleFileChange}
              />
              <div className="order-upload-drop-content">
                <FileText className="order-upload-input-icon" aria-hidden="true" />
                <p className="order-upload-drop-prompt">
                  {isDragging ? 'Drop XML files here to add them' : 'Drag and drop one or more XML files here'}
                </p>
                <p className="order-upload-drop-subtext">or</p>
                <Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
                  Browse XML files
                </Button>
              </div>
            </div>

            <p className="order-upload-file-status" aria-live="polite">
              {selectedFiles.length
                ? `${selectedFiles.length} XML file${selectedFiles.length > 1 ? 's' : ''} selected.`
                : 'No files selected yet.'}
            </p>

            {selectedFiles.length ? (
              <ul className="order-upload-file-list" aria-label="Selected files">
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="order-upload-file-item">{file.name}</li>
                ))}
              </ul>
            ) : null}

            {submitted ? (
              <p className="order-upload-success" role="status">
                Draft upload complete for {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}. API integration can be connected next.
              </p>
            ) : null}

            <div className="order-upload-actions">
              <Button type="submit" variant="secondary" size="sm" disabled={!selectedFiles.length}>
                <FileUp className="size-4" aria-hidden="true" />
                Upload XML Files
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/order">Back to Orders</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
