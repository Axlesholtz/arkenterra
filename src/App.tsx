import { useState } from 'react'
import MapView, { type OverlayId } from './map/MapView'
import Legend from './Legend'
import type { BasemapId } from './map/config'

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: 'topo', label: 'Topo' },
  { id: 'satellite', label: 'Satellite' },
]

const OVERLAYS: { id: OverlayId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'slope', label: 'Slope' },
  { id: 'aspect', label: 'Aspect' },
]

export default function App() {
  const [basemap, setBasemap] = useState<BasemapId>('satellite')
  const [overlay, setOverlay] = useState<OverlayId>('none')

  return (
    <div className="app">
      <MapView basemap={basemap} overlay={overlay} />
      <header className="brand">
        <h1>ArkenTerra</h1>
        <p>BC backcountry in 3D</p>
      </header>
      <div className="panel-stack">
        <nav className="toggle-group" aria-label="Basemap">
          {BASEMAPS.map(({ id, label }) => (
            <button
              key={id}
              className={basemap === id ? 'active' : ''}
              onClick={() => setBasemap(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <nav className="toggle-group" aria-label="Overlay">
          {OVERLAYS.map(({ id, label }) => (
            <button
              key={id}
              className={overlay === id ? 'active' : ''}
              onClick={() => setOverlay(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Legend overlay={overlay} />
    </div>
  )
}
