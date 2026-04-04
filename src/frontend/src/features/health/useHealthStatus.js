import { useEffect, useState } from 'react'

export function useHealthStatus() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/v1/health')
      .then(res => res.json())
      .then(data => setMessage(JSON.stringify(data)))
      .catch(() => setMessage('Failed to connect to the API'))
  }, [])

  return message
}
