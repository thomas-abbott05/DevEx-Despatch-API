import HealthStatus from '../features/health/HealthStatus'

export default function App() {
  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>DevEx Despatch API</h1>
      <p>This API is designed to serve project Category 2 (Despatch Advice documents). It allows for the creation, retrieval, modification and cancellation of Despatch Advice documents which are generated via an Order XML document. It also contains additional features like document validation for certain types, and receipt advice generation too.</p>
      <p>Resources and endpoints are protected via an API key header (see the docs) which you can obtain automatically via registration. This is to protect the documents your team creates and to prevent unfiltered public access.</p>
      <p>For support, contact us at devex@platform.tcore.network. We will get back to you as soon as we can :)</p>
      <b>!!! Automatic API key provisioning is available, see docs below. You must use a UNSW email!</b>
      <HealthStatus />
    </div>
  )
}
