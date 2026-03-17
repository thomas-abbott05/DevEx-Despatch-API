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
      <h1 style={{ marginBottom: '1rem' }}>DevEx Despatch API</h1>
      <p>This API is designed to serve project Category 2 (Despatch Advice documents). It allows for the creation, retrieval, modification and cancellation of Despatch Advice documents which are generated via an Order XML document. It also contains additional features like document validation for certain types, and receipt advice generation too.</p>
      <p>Resources and endpoints are protected via an API key header (see the docs) which you can obtain automatically via registration. This is to protect the documents your team creates and to prevent unfiltered public access.</p>
      <p>For support, contact us at devex@platform.tcore.network. We will get back to you as soon as we can :)</p>
      <b>!!! Automatic API key provisioning is available, see docs below. You must use a UNSW email!</b>
      <div id="app">
        <p><strong>API Response for /api/v1/health:</strong> {message}</p>
        <p>
          <a href="/api-docs">Click here for API Documentation (Swagger OpenAPI spec)</a>
        </p>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<Index/>)
