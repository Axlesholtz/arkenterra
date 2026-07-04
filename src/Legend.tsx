import type { OverlayId } from './map/MapView'
import { ASPECT_SECTORS, SLOPE_BANDS } from './map/demProtocol'

export default function Legend({ overlay }: { overlay: OverlayId }) {
  if (overlay === 'none') return null
  const items = (overlay === 'slope' ? SLOPE_BANDS : ASPECT_SECTORS).map(
    ({ label, rgb }) => ({
      label,
      color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    }),
  )
  return (
    <div className="legend-stack">
      <div className="legend">
        <span className="legend-title">
          {overlay === 'slope' ? 'Slope angle' : 'Aspect'}
        </span>
        {items.map(({ label, color }) => (
          <span key={label} className="legend-item">
            <span className="legend-swatch" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
