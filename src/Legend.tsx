import type { OverlayId } from './map/MapView'
import { ASPECT_SECTORS, SLOPE_BANDS } from './map/demProtocol'
import { AVALANCHE_COLORS } from './map/dataLayers'

const AVALANCHE_LEGEND = [
  { label: 'Low', color: AVALANCHE_COLORS.low },
  { label: 'Moderate', color: AVALANCHE_COLORS.moderate },
  { label: 'Considerable', color: AVALANCHE_COLORS.considerable },
  { label: 'High', color: AVALANCHE_COLORS.high },
  { label: 'Extreme', color: AVALANCHE_COLORS.extreme },
  { label: 'Off-season', color: AVALANCHE_COLORS.offseason },
]

function LegendBlock({
  title,
  items,
}: {
  title: string
  items: { label: string; color: string }[]
}) {
  return (
    <div className="legend">
      <span className="legend-title">{title}</span>
      {items.map(({ label, color }) => (
        <span key={label} className="legend-item">
          <span className="legend-swatch" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}

export default function Legend({
  overlay,
  avalanche,
}: {
  overlay: OverlayId
  avalanche: boolean
}) {
  if (overlay === 'none' && !avalanche) return null
  const overlayItems =
    overlay === 'slope'
      ? SLOPE_BANDS.map(({ label, rgb }) => ({
          label,
          color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        }))
      : overlay === 'aspect'
        ? ASPECT_SECTORS.map(({ label, rgb }) => ({
            label,
            color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
          }))
        : null
  return (
    <div className="legend-stack">
      {overlayItems && (
        <LegendBlock
          title={overlay === 'slope' ? 'Slope angle' : 'Aspect'}
          items={overlayItems}
        />
      )}
      {avalanche && <LegendBlock title="Avalanche danger" items={AVALANCHE_LEGEND} />}
    </div>
  )
}
