import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import mlcontour from 'maplibre-contour'
import {
  INITIAL_VIEW,
  TERRAIN_EXAGGERATION,
  TERRARIUM_TILES,
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
import { parksSource, wildfiresSource, type DataLayersState } from './dataLayers'
import type { LngLat } from '../route/geo'

registerDemProtocols()

// Contour isolines computed in a web worker from the same Terrarium tiles.
// maxzoom 12 matches BC's ~20 m DEM: higher zooms would trace interpolation
// noise instead of terrain.
const contourSource = new mlcontour.DemSource({
  url: TERRARIUM_TILES,
  encoding: 'terrarium',
  maxzoom: 12,
  worker: true,
})
contourSource.setupMaplibre(maplibregl)

export type OverlayId = DemOverlayKind | 'none'

export interface FlyTarget {
  lng: number
  lat: number
  zoom: number
  /** Changes on every request so repeat searches of the same place re-fly */
  id: number
}

interface MapViewProps {
  basemap: BasemapId
  overlay: OverlayId
  data: DataLayersState
  route: LngLat[]
  drawing: boolean
  hoverPoint: LngLat | null
  fitRouteSignal: number
  flyTarget: FlyTarget | null
  onRouteChange: (coords: LngLat[]) => void
  onFinishDrawing: () => void
}

function lineData(coords: LngLat[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      coords.length >= 2
        ? [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: {},
            },
          ]
        : [],
  }
}

function vertexData(coords: LngLat[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: coords.map((c, index) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: { index },
    })),
  }
}

function pointData(pt: LngLat | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pt
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: pt }, properties: {} }]
      : [],
  }
}

export default function MapView({
  basemap,
  overlay,
  data,
  route,
  drawing,
  hoverPoint,
  fitRouteSignal,
  flyTarget,
  onRouteChange,
  onFinishDrawing,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const basemapRef = useRef(basemap)
  basemapRef.current = basemap
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay
  const dataRef = useRef(data)
  dataRef.current = data
  const routeRef = useRef(route)
  routeRef.current = route
  const drawingRef = useRef(drawing)
  drawingRef.current = drawing
  const onRouteChangeRef = useRef(onRouteChange)
  onRouteChangeRef.current = onRouteChange
  const onFinishDrawingRef = useRef(onFinishDrawing)
  onFinishDrawingRef.current = onFinishDrawing
  // A vertex drag ends with a synthetic click we must not treat as "add point"
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TOPO_STYLE_URL,
      ...INITIAL_VIEW,
      maxPitch: 85,
      hash: 'map',
      attributionControl: { compact: true },
      // Longer glide after a drag — the default stops abruptly
      dragPan: { linearity: 0, deceleration: 1600, maxSpeed: 1600 },
    })
    mapRef.current = map
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__arkenmap = map
    }
    // Snappier wheel steps, slightly gentler trackpad pinch
    map.scrollZoom.setWheelZoomRate(1 / 250)
    map.scrollZoom.setZoomRate(1 / 90)

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
      // Parks sit under the hillshade so terrain shading tints them too
      map.addSource('parks', parksSource())
      map.addLayer(
        {
          id: 'parks',
          type: 'raster',
          source: 'parks',
          layout: { visibility: dataRef.current.parks ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.55 },
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

      map.addSource('contours', {
        type: 'vector',
        tiles: [
          contourSource.contourProtocolUrl({
            multiplier: 1,
            thresholds: {
              // zoom: [minor, major] interval in metres
              10: [500, 2500],
              11: [200, 1000],
              12: [100, 500],
              14: [50, 250],
              15: [20, 100],
            },
            contourLayer: 'contours',
            elevationKey: 'ele',
            levelKey: 'level',
            extent: 4096,
            buffer: 1,
          }),
        ],
        maxzoom: 15,
      })
      const contoursVisible =
        basemapRef.current === 'topo' ? 'visible' : 'none'
      map.addLayer(
        {
          id: 'contour-lines',
          type: 'line',
          source: 'contours',
          'source-layer': 'contours',
          layout: { visibility: contoursVisible },
          paint: {
            'line-color': 'rgba(125, 92, 60, 0.55)',
            'line-width': ['match', ['get', 'level'], 1, 1.1, 0.45],
          },
        },
        firstSymbolId,
      )
      map.addLayer(
        {
          id: 'contour-labels',
          type: 'symbol',
          source: 'contours',
          'source-layer': 'contours',
          filter: ['>', ['get', 'level'], 0],
          layout: {
            visibility: contoursVisible,
            'symbol-placement': 'line',
            'text-size': 10,
            'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
            'text-font': ['Noto Sans Regular'],
          },
          paint: {
            'text-color': '#6b4f33',
            'text-halo-color': 'rgba(255,255,255,0.85)',
            'text-halo-width': 1,
          },
        },
        firstSymbolId,
      )

      // Trails/peaks/huts already live in the OpenFreeMap tiles — the base
      // style just barely shows them. Style them like an outdoor map, on
      // both basemaps.
      map.addLayer(
        {
          id: 'trails',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 11,
          filter: [
            'all',
            ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
            ['match', ['get', 'class'], ['path', 'track'], true, false],
            ['match', ['get', 'subclass'], ['steps', 'corridor', 'platform'], false, true],
          ],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#d64524',
            'line-dasharray': [2.5, 1.5],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 14, 1.6, 16, 2.6],
          },
        },
        firstSymbolId,
      )

      map.addSource('wildfires', wildfiresSource())
      map.addLayer(
        {
          id: 'wildfires',
          type: 'raster',
          source: 'wildfires',
          layout: { visibility: dataRef.current.wildfires ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.85 },
        },
        firstSymbolId,
      )

      map.addLayer(
        {
          id: 'peak-labels',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'mountain_peak',
          minzoom: 10,
          filter: ['all', ['has', 'name'], ['==', ['get', 'class'], 'peak']],
          layout: {
            'text-field': [
              'case',
              ['has', 'ele'],
              ['concat', '▲ ', ['get', 'name'], '\n', ['get', 'ele'], ' m'],
              ['concat', '▲ ', ['get', 'name']],
            ],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#4a3f35',
            'text-halo-color': 'rgba(255,255,255,0.9)',
            'text-halo-width': 1.2,
          },
        },
        firstSymbolId,
      )
      map.addLayer(
        {
          id: 'hut-points',
          type: 'circle',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 11,
          filter: [
            'match',
            ['get', 'subclass'],
            ['alpine_hut', 'wilderness_hut', 'shelter'],
            true,
            false,
          ],
          paint: {
            'circle-radius': 4,
            'circle-color': '#8b2f1d',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.2,
          },
        },
        firstSymbolId,
      )
      map.addLayer(
        {
          id: 'hut-labels',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 12,
          filter: [
            'all',
            ['has', 'name'],
            [
              'match',
              ['get', 'subclass'],
              ['alpine_hut', 'wilderness_hut', 'shelter'],
              true,
              false,
            ],
          ],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 0.7],
          },
          paint: {
            'text-color': '#6b2416',
            'text-halo-color': 'rgba(255,255,255,0.9)',
            'text-halo-width': 1.1,
          },
        },
        firstSymbolId,
      )

      // Route layers go on top of everything, labels included — the route is
      // the user's own content.
      map.addSource('route', { type: 'geojson', data: lineData(routeRef.current) })
      map.addSource('route-vertices', {
        type: 'geojson',
        data: vertexData(routeRef.current),
      })
      map.addSource('route-hover', { type: 'geojson', data: pointData(null) })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 6 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ff5c1f', 'line-width': 3.5 },
      })
      map.addLayer({
        id: 'route-vertex',
        type: 'circle',
        source: 'route-vertices',
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#ff5c1f',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'route-hover-point',
        type: 'circle',
        source: 'route-hover',
        paint: {
          'circle-radius': 7,
          'circle-color': '#1d6ef5',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })

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

    map.on('click', (e) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      if (!drawingRef.current) return
      onRouteChangeRef.current([...routeRef.current, [e.lngLat.lng, e.lngLat.lat]])
    })

    map.on('dblclick', (e) => {
      if (!drawingRef.current) return
      e.preventDefault() // keep double-click-zoom while not drawing
      onFinishDrawingRef.current()
    })

    map.on('mouseenter', 'route-vertex', () => {
      if (!drawingRef.current) map.getCanvas().style.cursor = 'grab'
    })
    map.on('mouseleave', 'route-vertex', () => {
      map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : ''
    })

    map.on('mousedown', 'route-vertex', (e: MapLayerMouseEvent) => {
      const index = e.features?.[0]?.properties?.index
      if (typeof index !== 'number') return
      e.preventDefault() // don't pan the map while dragging a vertex
      const onMove = (ev: maplibregl.MapMouseEvent) => {
        const coords = [...routeRef.current]
        coords[index] = [ev.lngLat.lng, ev.lngLat.lat]
        onRouteChangeRef.current(coords)
      }
      map.on('mousemove', onMove)
      map.once('mouseup', () => {
        map.off('mousemove', onMove)
        suppressClickRef.current = true
      })
    })

    map.on('contextmenu', 'route-vertex', (e: MapLayerMouseEvent) => {
      const index = e.features?.[0]?.properties?.index
      if (typeof index !== 'number') return
      e.originalEvent.preventDefault()
      onRouteChangeRef.current(routeRef.current.filter((_, i) => i !== index))
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
    for (const id of ['contour-lines', 'contour-labels']) {
      map.setLayoutProperty(id, 'visibility', basemap === 'topo' ? 'visible' : 'none')
    }
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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('parks')) return
    map.setLayoutProperty('parks', 'visibility', data.parks ? 'visible' : 'none')
    map.setLayoutProperty('wildfires', 'visibility', data.wildfires ? 'visible' : 'none')
  }, [data])

  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource('route') as GeoJSONSource | undefined
    if (!map || !source) return
    source.setData(lineData(route))
    ;(map.getSource('route-vertices') as GeoJSONSource).setData(vertexData(route))
  }, [route])

  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource('route-hover') as GeoJSONSource | undefined
    source?.setData(pointData(hoverPoint))
  }, [hoverPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = drawing ? 'crosshair' : ''
  }, [drawing])

  useEffect(() => {
    const map = mapRef.current
    const coords = routeRef.current
    if (!map || fitRouteSignal === 0 || coords.length < 2) return
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    )
    map.fitBounds(bounds, { padding: 80, duration: 1200 })
  }, [fitRouteSignal])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTarget) return
    map.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom,
      pitch: 65,
      duration: 2500,
    })
  }, [flyTarget])

  return <div ref={containerRef} className="map-container" />
}
