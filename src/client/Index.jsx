import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

function Index() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/v1/health')
      .then(res => res.json())
      .then(data => setMessage(JSON.stringify(data)))
      .catch(() => setMessage('Failed to connect to the API'))
  }, [])

  return (
    <div className="container">
      <h1>DevEx Despatch API</h1>
      <p>Category 2 — Despatch Document Management</p>
      <div id="app">
        <p><strong>API Response:</strong> {message}</p>
        <p>
          <a href="/api-docs">View API Documentation (Swagger)</a>
        </p>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<Index/>)
