import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  INITIAL_VIEW,
  TERRAIN_EXAGGERATION,
  TOPO_STYLE_URL,
  hillshadeSource,
  satelliteSource,
  terrainSource,
  type BasemapId,
} from './config'
import {
  DEM_OVERLAY_MAXZOOM,
  registerDemProtocols,
  type DemOverlayKind,
} from './demProtocol'

registerDemProtocols()

export type OverlayId = DemOverlayKind | 'none'

interface MapViewProps {
  basemap: BasemapId
  overlay: OverlayId
}

export default function MapView({ basemap, overlay }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const basemapRef = useRef(basemap)
  basemapRef.current = basemap
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TOPO_STYLE_URL,
      ...INITIAL_VIEW,
      maxPitch: 85,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }))
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    map.addControl(new maplibregl.GlobeControl())

    map.on('load', () => {
      map.addSource('terrain-dem', terrainSource())
      map.addSource('hillshade-dem', hillshadeSource())
      map.addSource('satellite', satelliteSource())

      // Slot rasters beneath the vector labels so place names stay readable
      // in satellite mode.
      const firstSymbolId = map
        .getStyle()
        .layers.find((layer) => layer.type === 'symbol')?.id

      map.addLayer(
        {
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
          layout: { visibility: basemapRef.current === 'satellite' ? 'visible' : 'none' },
        },
        firstSymbolId,
      )
      map.addLayer(
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'hillshade-dem',
          paint: {
            'hillshade-exaggeration': 0.35,
            'hillshade-shadow-color': '#2f3f4f',
          },
        },
        firstSymbolId,
      )

      for (const kind of ['slope', 'aspect'] as const) {
        map.addSource(kind, {
          type: 'raster',
          tiles: [`${kind}://{z}/{x}/{y}`],
          tileSize: 256,
          maxzoom: DEM_OVERLAY_MAXZOOM,
        })
        map.addLayer(
          {
            id: `${kind}-overlay`,
            type: 'raster',
            source: kind,
            layout: {
              visibility: overlayRef.current === kind ? 'visible' : 'none',
            },
            paint: { 'raster-fade-duration': 100 },
          },
          firstSymbolId,
        )
      }

      map.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION })
      map.setSky({
        'sky-color': '#8fb8dd',
        'horizon-color': '#eef4f8',
        'fog-color': '#e8eef2',
        'sky-horizon-blend': 0.7,
        'horizon-fog-blend': 0.5,
        'fog-ground-blend': 0.9,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.4],
      })
    })

    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('satellite')) return
    map.setLayoutProperty(
      'satellite',
      'visibility',
      basemap === 'satellite' ? 'visible' : 'none',
    )
    // Soften the hillshade over imagery — it only needs to add depth there,
    // not carry the whole terrain read like it does on the vector map.
    map.setPaintProperty(
      'hillshade',
      'hillshade-exaggeration',
      basemap === 'satellite' ? 0.15 : 0.35,
    )
  }, [basemap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('slope-overlay')) return
    for (const kind of ['slope', 'aspect'] as const) {
      map.setLayoutProperty(
        `${kind}-overlay`,
        'visibility',
        overlay === kind ? 'visible' : 'none',
      )
    }
  }, [overlay])

  return <div ref={containerRef} className="map-container" />
}
