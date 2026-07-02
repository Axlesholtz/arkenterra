import { useState } from 'react'
import type { LngLat } from './geo'
import type { RouteProfile } from './useRouteProfile'

const W = 640
const H = 110
const L = 44
const R = 10
const T = 8
const B = 18

function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

export default function ElevationProfile({
  profile,
  onHover,
}: {
  profile: RouteProfile | null
  onHover: (p: LngLat | null) => void
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  if (!profile) return null
  const { samples, stats } = profile
  if (samples.length < 2 || stats.distance <= 0) return null

  const span = Math.max(10, stats.maxEle - stats.minEle)
  const x = (dist: number) => L + (dist / stats.distance) * (W - L - R)
  const y = (ele: number) => T + (1 - (ele - stats.minEle) / span) * (H - T - B)

  const line = samples
    .map((s, i) => `${i ? 'L' : 'M'}${x(s.dist).toFixed(1)},${y(s.ele).toFixed(1)}`)
    .join('')
  const area = `${line}L${x(stats.distance).toFixed(1)},${H - B}L${L},${H - B}Z`

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dist =
      (((e.clientX - rect.left) / rect.width) * W - L) / (W - L - R) * stats.distance
    // samples are ordered by distance — nearest by linear scan is fine at ~400
    let best = 0
    for (let i = 1; i < samples.length; i++) {
      if (Math.abs(samples[i].dist - dist) < Math.abs(samples[best].dist - dist)) best = i
    }
    setHoverIdx(best)
    onHover([samples[best].lng, samples[best].lat])
  }
  const handleLeave = () => {
    setHoverIdx(null)
    onHover(null)
  }

  const hover = hoverIdx !== null ? samples[hoverIdx] : null

  return (
    <div className="profile-panel">
      <div className="profile-stats">
        <span>{fmtKm(stats.distance)}</span>
        <span>↑ {Math.round(stats.gain)} m</span>
        <span>↓ {Math.round(stats.loss)} m</span>
        <span>
          {Math.round(stats.minEle)}–{Math.round(stats.maxEle)} m
        </span>
        {hover && (
          <span className="profile-hover-readout">
            {Math.round(hover.ele)} m @ {fmtKm(hover.dist)}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="profile-chart"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <path d={area} fill="rgba(93, 156, 216, 0.35)" />
        <path d={line} fill="none" stroke="#8fc1ee" strokeWidth="1.5" />
        <text x={L - 6} y={y(stats.maxEle) + 4} textAnchor="end" className="profile-axis">
          {Math.round(stats.maxEle)}
        </text>
        <text x={L - 6} y={H - B + 4} textAnchor="end" className="profile-axis">
          {Math.round(stats.minEle)}
        </text>
        <text x={W - R} y={H - 4} textAnchor="end" className="profile-axis">
          {fmtKm(stats.distance)}
        </text>
        {hover && (
          <>
            <line
              x1={x(hover.dist)}
              x2={x(hover.dist)}
              y1={T}
              y2={H - B}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1"
            />
            <circle cx={x(hover.dist)} cy={y(hover.ele)} r="3.5" fill="#ffffff" />
          </>
        )}
      </svg>
    </div>
  )
}
