export default function MeshGradientBackground({ children }) {
  return (
    <div className="mesh-gradient-root">
      <div className="mesh-orb mesh-orb-1" />
      <div className="mesh-orb mesh-orb-2" />
      <div className="mesh-orb mesh-orb-3" />
      <div className="mesh-orb mesh-orb-4" />
      <div className="mesh-noise" />
      <div className="mesh-content">{children}</div>
    </div>
  )
}
