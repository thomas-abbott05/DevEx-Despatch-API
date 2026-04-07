import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp, Trash2, Truck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { uploadDespatchXmlDocuments } from '@/features/despatch/api/despatch-api'
import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteTopbar from '@/components/layout/SiteTopbar'
import './styles/UploadDespatchPage.css'

function isXmlFile(file) {
  const fileName = file?.name?.toLowerCase() || ''
  return fileName.endsWith('.xml')
}

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export default function UploadDespatchPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const firstName = user?.firstName?.trim() || user?.email?.split('@')[0] || 'there'
  const fileInputRef = useRef(null)
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Despatch Advice', to: '/despatch' },
    { label: 'Upload Despatch Advice' },
  ]

  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState('')

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
    setUploadResult(null)
    setUploadError('')

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
    setUploadResult(null)
    setUploadError('')

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

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedFiles.length || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setUploadError('')
    setUploadResult(null)

    try {
      const documents = await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          xml: await file.text(),
        })),
      )

      const result = await uploadDespatchXmlDocuments(documents)
      const failedFileNames = new Set(
        (Array.isArray(result?.failures) ? result.failures : [])
          .map((failure) => String(failure?.fileName || '').trim())
          .filter(Boolean),
      )

      setUploadResult(result)
      setSubmitted(true)

      if (failedFileNames.size > 0) {
        setSelectedFiles((currentFiles) => currentFiles.filter((file) => failedFileNames.has(file.name)))
      } else {
        setSelectedFiles([])
      }
    } catch (error) {
      setSubmitted(false)
      setUploadError(error?.message || 'Unable to upload despatch XML documents.')
    } finally {
      setIsSubmitting(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <main className="home-screen despatch-upload-page">
      <SiteTopbar firstName={firstName} onLogout={handleLogout} breadcrumbs={breadcrumbs} />

      <section className="home-content despatch-upload-content">
        <header className="despatch-upload-header">
          <h1 className="despatch-upload-title">Upload Despatch Advice</h1>
          <p className="despatch-upload-subtitle">Upload UBL Despatch Advice XML files for invoice creation or receipt advice generation.</p>
        </header>

        <div className="despatch-upload-card">
          <form className="despatch-upload-form" onSubmit={handleSubmit}>
            <label className="despatch-upload-label" htmlFor="despatch-xml-file">Despatch Advice XML files</label>
            <div
              className={`despatch-upload-dropzone${isDragging ? ' is-dragging' : ''}`}
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
                id="despatch-xml-file"
                className="despatch-upload-input"
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                onChange={handleFileChange}
              />
              <div className="despatch-upload-drop-content">
                <Truck className="despatch-upload-input-icon" aria-hidden="true" />
                <p className="despatch-upload-drop-prompt">
                  {isDragging ? 'Drop XML files here to add them' : 'Drag and drop one or more XML files here'}
                </p>
                <p className="despatch-upload-drop-subtext">or</p>
                <Button type="button" className="file-picker-button" size="sm" onClick={openFilePicker}>
                  Add files from your device
                </Button>
              </div>
            </div>

            <p className="despatch-upload-file-status" aria-live="polite">
              {selectedFiles.length
                ? `${selectedFiles.length} XML file${selectedFiles.length > 1 ? 's' : ''} selected.`
                : 'No files selected yet.'}
            </p>

            {selectedFiles.length ? (
              <ul className="despatch-upload-file-list" aria-label="Selected files">
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="despatch-upload-file-item">
                    <span className="despatch-upload-file-name">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="despatch-upload-file-remove"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeSelectedFile(file)}
                    >
                      <Trash2 className="despatch-upload-file-remove-icon" aria-hidden="true" />
                      <span className="despatch-upload-file-remove-text">Remove file</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {uploadError ? (
              <p className="despatch-upload-error" role="alert">
                {uploadError}
              </p>
            ) : null}

            {submitted && uploadResult ? (
              <p className="despatch-upload-success" role="status">
                Uploaded {uploadResult.uploadedCount} despatch XML file{uploadResult.uploadedCount === 1 ? '' : 's'}.
                {uploadResult.failedCount
                  ? ` ${uploadResult.failedCount} file${uploadResult.failedCount === 1 ? '' : 's'} still need attention.`
                  : ' All selected files were processed successfully.'}
              </p>
            ) : null}

            {uploadResult?.failedCount ? (
              <ul className="despatch-upload-failure-list" aria-label="Upload failures">
                {uploadResult.failures.map((failure, index) => (
                  <li key={`${failure.fileName || 'file'}-${index}`} className="despatch-upload-failure-item">
                    {failure.message || 'Unable to process one uploaded file.'}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="despatch-upload-actions">
              <Button
                type="submit"
                variant="ghost"
                className="upload-confirm-btn"
                size="sm"
                disabled={!selectedFiles.length || isSubmitting}
              >
                <FileUp className="upload-confirm-icon" aria-hidden="true" />
                {isSubmitting ? 'Uploading...' : 'Upload XML Files'}
              </Button>
              <Button asChild type="button" variant="ghost" className="upload-cancel-btn" size="sm">
                <Link to="/despatch">Cancel upload</Link>
              </Button>
            </div>
          </form>
        </div>

        <SiteFooter hideHome className="home-footer" />
      </section>
    </main>
  )
}
