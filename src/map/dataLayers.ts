import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, RasterSourceSpecification } from 'maplibre-gl'

/**
 * Public BC government and Avalanche Canada data layers, plus styling for
 * the outdoor features (trails/peaks/huts) already present in the
 * OpenFreeMap vector tiles.
 */

export type DataLayerId = 'parks' | 'wildfires' | 'avalanche'

export interface DataLayersState {
  parks: boolean
  wildfires: boolean
  avalanche: boolean
}

const BC_WMS = 'https://openmaps.gov.bc.ca/geo/ows'

function bcWmsSource(layers: string[], attribution: string): RasterSourceSpecification {
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.3.0',
    layers: layers.join(','),
    styles: '',
    format: 'image/png',
    transparent: 'true',
    crs: 'EPSG:3857',
    width: '256',
    height: '256',
  })
  return {
    type: 'raster',
    tiles: [`${BC_WMS}?${params.toString()}&bbox={bbox-epsg-3857}`],
    tileSize: 256,
    attribution,
  }
}

/** BC parks/protected areas plus Recreation Sites and Trails polygons. */
export function parksSource(): RasterSourceSpecification {
  return bcWmsSource(
    [
      'pub:WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW',
      'pub:WHSE_FOREST_TENURE.FTEN_RECREATION_POLY_SVW',
    ],
    'Parks: <a href="https://catalogue.data.gov.bc.ca/">DataBC</a>',
  )
}

/** BC Wildfire Service current fire perimeters and locations. */
export function wildfiresSource(): RasterSourceSpecification {
  return bcWmsSource(
    [
      'pub:WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_POLYS_SP',
      'pub:WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_PNTS_SP',
    ],
    'Wildfires: <a href="https://www2.gov.bc.ca/gov/content/safety/wildfire-status">BC Wildfire Service</a>',
  )
}

// --- Avalanche Canada forecasts ---

const AVCAN_API = 'https://api.avalanche.ca/forecasts/en'

/** Danger-scale severity order; regions are coloured by their worst band. */
const RATING_SEVERITY = ['low', 'moderate', 'considerable', 'high', 'extreme']

export const AVALANCHE_COLORS: Record<string, string> = {
  low: '#52ba4a',
  moderate: '#fff300',
  considerable: '#f79218',
  high: '#ef1c29',
  extreme: '#221f20',
  offseason: '#8a939b',
  norating: '#8a939b',
}

export function avalancheFillColor(): ExpressionSpecification {
  return [
    'match',
    ['get', 'rating'],
    ...Object.entries(AVALANCHE_COLORS).flat(),
    '#8a939b',
  ] as unknown as ExpressionSpecification
}

interface AvCanRating {
  display: string
  rating: { value: string; display: string }
}

interface AvCanProduct {
  type: string
  url: string
  area: { id: string }
  report?: {
    title?: string
    validUntil?: string
    dangerRatings?: {
      date: { display: string }
      ratings: Record<string, AvCanRating>
    }[]
  }
}

export interface AvalancheRegionProps {
  title: string
  url: string
  rating: string
  ratingsHtml: string
  [key: string]: unknown
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Fetches forecast region polygons and current products, joining danger
 * ratings onto each region. Off-season (summer) every region reports
 * "Summer Conditions" and renders grey.
 */
export async function fetchAvalancheRegions(): Promise<FeatureCollection> {
  const [areasRes, productsRes] = await Promise.all([
    fetch(`${AVCAN_API}/areas`),
    fetch(`${AVCAN_API}/products`),
  ])
  if (!areasRes.ok || !productsRes.ok) throw new Error('Avalanche Canada API unavailable')
  const areas = (await areasRes.json()) as FeatureCollection
  const products = (await productsRes.json()) as AvCanProduct[]

  const byArea = new Map<string, AvCanProduct>()
  for (const p of products) {
    if (p.type === 'avalancheforecast' && p.area?.id) byArea.set(p.area.id, p)
  }

  const features = areas.features
    .map((f) => {
      const product = byArea.get(String(f.id))
      if (!product?.report) return null
      const today = product.report.dangerRatings?.[0]
      let worst = 'norating'
      let worstRank = -1
      const rows: string[] = []
      for (const band of Object.values(today?.ratings ?? {})) {
        const value = band.rating.value
        const rank = RATING_SEVERITY.indexOf(value)
        if (rank > worstRank) {
          worstRank = rank
          worst = value
        } else if (worstRank === -1) {
          worst = value
        }
        rows.push(
          `<tr><td>${escapeHtml(band.display)}</td><td>${escapeHtml(band.rating.display)}</td></tr>`,
        )
      }
      const properties: AvalancheRegionProps = {
        title: product.report.title ?? 'Avalanche forecast',
        url: product.url,
        rating: worst,
        ratingsHtml: `<table>${rows.join('')}</table>`,
      }
      return { ...f, properties }
    })
    .filter((f) => f !== null)

  return { type: 'FeatureCollection', features }
}
