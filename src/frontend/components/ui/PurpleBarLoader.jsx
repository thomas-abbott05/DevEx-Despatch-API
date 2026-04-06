import { BarLoader } from 'react-spinners'

export default function PurpleBarLoader({
  statusLabel = 'Loading content',
  maxWidth = '320px',
  className = ''
}) {
  const loaderClassName = ['purple-bar-loader', className].filter(Boolean).join(' ')

  return (
    <div
      className={loaderClassName}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      aria-busy="true"
      style={{
        width: `min(100%, ${maxWidth})`,
        padding: '0.45rem 0',
        marginInline: 'auto'
      }}
    >
      <BarLoader color="#3f3593" width="100%" height={5} speedMultiplier={2} />
    </div>
  )
}