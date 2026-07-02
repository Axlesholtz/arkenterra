import { useState } from 'react'
import MapView from './map/MapView'
import type { BasemapId } from './map/config'

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: 'topo', label: 'Topo' },
  { id: 'satellite', label: 'Satellite' },
]

export default function App() {
  const [basemap, setBasemap] = useState<BasemapId>('satellite')

  return (
    <div className="app">
      <MapView basemap={basemap} />
      <header className="brand">
        <h1>ArkenTerra</h1>
        <p>BC backcountry in 3D</p>
      </header>
      <nav className="basemap-toggle" aria-label="Basemap">
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
    </div>
  )
}
