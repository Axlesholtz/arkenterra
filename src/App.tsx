import { useCallback, useEffect, useState } from 'react'
import MapView, { type OverlayId } from './map/MapView'
import Legend from './Legend'
import RoutePanel from './route/RoutePanel'
import ElevationProfile from './route/ElevationProfile'
import { useRouteProfile } from './route/useRouteProfile'
import {
  decodePolyline,
  encodePolyline,
  haversine,
  type LngLat,
} from './route/geo'
import { buildGPX, downloadGPX } from './route/gpx'
import { deleteRoute, loadRoutes, saveRoute, type SavedRoute } from './route/store'
import type { BasemapId } from './map/config'
import type { DataLayersState } from './map/dataLayers'

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: 'topo', label: 'Topo' },
  { id: 'satellite', label: 'Satellite' },
]

const OVERLAYS: { id: OverlayId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'slope', label: 'Slope' },
  { id: 'aspect', label: 'Aspect' },
]

const DATA_LAYERS: { id: keyof DataLayersState; label: string }[] = [
  { id: 'parks', label: 'Parks' },
  { id: 'wildfires', label: 'Fires' },
  { id: 'avalanche', label: 'Avalanche' },
]

const DEFAULT_NAME = 'My route'

// The URL hash is shared with MapLibre's camera state (`#map=...&r=...`), so
// parse and rewrite it segment-wise, leaving foreign keys untouched.
function getHashParam(key: string): string | null {
  const part = location.hash
    .slice(1)
    .split('&')
    .find((s) => s.startsWith(`${key}=`))
  return part ? decodeURIComponent(part.slice(key.length + 1)) : null
}

function setHashParams(update: Record<string, string | null>) {
  const parts = location.hash
    .slice(1)
    .split('&')
    .filter((s) => s && !(s.split('=')[0] in update))
  for (const [k, v] of Object.entries(update)) {
    if (v !== null) parts.push(`${k}=${encodeURIComponent(v)}`)
  }
  history.replaceState(
    null,
    '',
    parts.length ? `#${parts.join('&')}` : location.pathname + location.search,
  )
}

function routeFromHash(): LngLat[] {
  const encoded = getHashParam('r')
  if (!encoded) return []
  try {
    return decodePolyline(encoded)
  } catch {
    return []
  }
}

export default function App() {
  const [basemap, setBasemap] = useState<BasemapId>('satellite')
  const [overlay, setOverlay] = useState<OverlayId>('none')
  const [dataLayers, setDataLayers] = useState<DataLayersState>({
    parks: false,
    wildfires: false,
    avalanche: false,
  })
  const [route, setRoute] = useState<LngLat[]>(routeFromHash)
  const [routeName, setRouteName] = useState(() => getHashParam('n') ?? DEFAULT_NAME)
  const [drawing, setDrawing] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<LngLat | null>(null)
  const [saved, setSaved] = useState<SavedRoute[]>(loadRoutes)
  const [copied, setCopied] = useState(false)
  const [fitRouteSignal, setFitRouteSignal] = useState(0)

  const profile = useRouteProfile(route)

  useEffect(() => {
    setHashParams({
      r: route.length >= 2 ? encodePolyline(route) : null,
      n: route.length >= 2 && routeName !== DEFAULT_NAME ? routeName : null,
    })
  }, [route, routeName])

  const finishDrawing = useCallback(() => {
    setDrawing(false)
    // A double-click to finish also fired two clicks at the same spot —
    // drop the trailing duplicate vertex.
    setRoute((coords) => {
      let trimmed = coords
      while (
        trimmed.length >= 2 &&
        haversine(trimmed[trimmed.length - 2], trimmed[trimmed.length - 1]) < 3
      ) {
        trimmed = trimmed.slice(0, -1)
      }
      return trimmed
    })
  }, [])

  useEffect(() => {
    if (!drawing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') finishDrawing()
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setRoute((coords) => coords.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawing, finishDrawing])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — the URL is already in the address bar
    }
  }

  const handleLoad = (id: string) => {
    const r = saved.find((s) => s.id === id)
    if (!r) return
    setRoute(r.coords)
    setRouteName(r.name)
    setDrawing(false)
    setFitRouteSignal((n) => n + 1)
  }

  return (
    <div className="app">
      <MapView
        basemap={basemap}
        overlay={overlay}
        data={dataLayers}
        route={route}
        drawing={drawing}
        hoverPoint={hoverPoint}
        fitRouteSignal={fitRouteSignal}
        onRouteChange={setRoute}
        onFinishDrawing={finishDrawing}
      />
      <header className="brand">
        <h1>ArkenTerra</h1>
        <p>BC backcountry in 3D</p>
      </header>
      <RoutePanel
        drawing={drawing}
        hasRoute={route.length > 0}
        canExport={profile !== null}
        name={routeName}
        copied={copied}
        saved={saved}
        onToggleDraw={() => (drawing ? finishDrawing() : setDrawing(true))}
        onClear={() => {
          setRoute([])
          setRouteName(DEFAULT_NAME)
          setDrawing(false)
        }}
        onSave={() => setSaved(saveRoute(routeName, route))}
        onExport={() => profile && downloadGPX(routeName, buildGPX(routeName, profile.samples))}
        onShare={handleShare}
        onLoad={handleLoad}
        onDelete={(id) => setSaved(deleteRoute(id))}
        onNameChange={setRouteName}
      />
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
        <nav className="toggle-group" aria-label="Data layers">
          {DATA_LAYERS.map(({ id, label }) => (
            <button
              key={id}
              className={dataLayers[id] ? 'active' : ''}
              onClick={() => setDataLayers((d) => ({ ...d, [id]: !d[id] }))}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Legend overlay={overlay} avalanche={dataLayers.avalanche} />
      <ElevationProfile profile={profile} onHover={setHoverPoint} />
    </div>
  )
}
