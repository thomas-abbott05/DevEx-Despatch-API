import { useHealthStatus } from './useHealthStatus'

export default function HealthStatus() {
  const message = useHealthStatus()

  return (
    <div id="app">
      <p><strong>API Response for /api/v1/health:</strong> {message}</p>
      <p>
        <a href="/api-docs">Click here for API Documentation (Swagger OpenAPI spec)</a>
      </p>
    </div>
  )
}
