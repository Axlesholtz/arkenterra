import maplibregl from 'maplibre-gl'
import type { RequestParameters } from 'maplibre-gl'

/**
 * Custom tile protocols that derive slope-angle and aspect rasters from
 * Terrarium elevation tiles entirely in the browser — no server-side
 * pipeline. Registered as `slope://{z}/{x}/{y}` and `aspect://{z}/{x}/{y}`.
 */

export type DemOverlayKind = 'slope' | 'aspect'

const TILE = 256
const PAD = TILE + 2 // one-pixel apron from neighbour tiles, avoids seams
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
const OVERLAY_ALPHA = 150

/** Standard avalanche-terrain slope bands (ascending). */
export const SLOPE_BANDS = [
  { min: 27, label: '27–30°', rgb: [244, 233, 66] as const },
  { min: 30, label: '30–35°', rgb: [245, 166, 35] as const },
  { min: 35, label: '35–40°', rgb: [229, 57, 31] as const },
  { min: 40, label: '40–45°', rgb: [176, 38, 155] as const },
  { min: 45, label: '45–50°', rgb: [122, 38, 205] as const },
  { min: 50, label: '50°+', rgb: [40, 0, 60] as const },
]

/** Eight compass sectors, N first, clockwise. */
export const ASPECT_SECTORS = [
  { label: 'N', rgb: [67, 99, 216] as const },
  { label: 'NE', rgb: [66, 212, 244] as const },
  { label: 'E', rgb: [60, 180, 75] as const },
  { label: 'SE', rgb: [191, 239, 69] as const },
  { label: 'S', rgb: [255, 225, 25] as const },
  { label: 'SW', rgb: [245, 130, 49] as const },
  { label: 'W', rgb: [230, 25, 75] as const },
  { label: 'NW', rgb: [145, 30, 180] as const },
]

/** Below this slope, aspect is noise — leave it transparent. */
const ASPECT_MIN_SLOPE_DEG = 3

/**
 * The DEM is ~20 m native in BC (CDEM), which matches z13 pixels; computing
 * gradients at higher zooms on interpolated data just underestimates slopes.
 */
export const DEM_OVERLAY_MAXZOOM = 13

type Elevations = Float32Array | null

const demCache = new Map<string, Promise<Elevations>>()
const DEM_CACHE_MAX = 128

function fetchDem(z: number, x: number, y: number): Promise<Elevations> {
  const n = 1 << z
  if (y < 0 || y >= n) return Promise.resolve(null)
  x = ((x % n) + n) % n
  const key = `${z}/${x}/${y}`
  let pending = demCache.get(key)
  if (!pending) {
    pending = loadDem(z, x, y)
    demCache.set(key, pending)
    if (demCache.size > DEM_CACHE_MAX) {
      const oldest = demCache.keys().next().value
      if (oldest !== undefined) demCache.delete(oldest)
    }
  }
  return pending
}

async function loadDem(z: number, x: number, y: number): Promise<Elevations> {
  try {
    const res = await fetch(`${DEM_TILES}/${z}/${x}/${y}.png`)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob(), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    const canvas = new OffscreenCanvas(TILE, TILE)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { data } = ctx.getImageData(0, 0, TILE, TILE)
    const elev = new Float32Array(TILE * TILE)
    for (let i = 0; i < elev.length; i++) {
      const p = i * 4
      elev[i] = data[p] * 256 + data[p + 1] + data[p + 2] / 256 - 32768
    }
    return elev
  } catch {
    return null
  }
}

/**
 * Elevations for the tile plus a one-pixel apron borrowed from the eight
 * neighbours (clamped to the tile's own edge where a neighbour is missing).
 * Neighbours share the promise cache, so a viewport of tiles fetches each
 * DEM tile once.
 */
async function paddedElevations(
  z: number,
  x: number,
  y: number,
): Promise<Float32Array | null> {
  const center = await fetchDem(z, x, y)
  if (!center) return null

  const grid = new Float32Array(PAD * PAD)
  for (let r = 0; r < TILE; r++) {
    grid.set(center.subarray(r * TILE, (r + 1) * TILE), (r + 1) * PAD + 1)
  }

  const [nw, nn, ne, ww, ee, sw, ss, se] = await Promise.all([
    fetchDem(z, x - 1, y - 1),
    fetchDem(z, x, y - 1),
    fetchDem(z, x + 1, y - 1),
    fetchDem(z, x - 1, y),
    fetchDem(z, x + 1, y),
    fetchDem(z, x - 1, y + 1),
    fetchDem(z, x, y + 1),
    fetchDem(z, x + 1, y + 1),
  ])

  const last = TILE - 1
  for (let c = 0; c < TILE; c++) {
    grid[c + 1] = nn ? nn[last * TILE + c] : center[c]
    grid[(PAD - 1) * PAD + c + 1] = ss ? ss[c] : center[last * TILE + c]
  }
  for (let r = 0; r < TILE; r++) {
    grid[(r + 1) * PAD] = ww ? ww[r * TILE + last] : center[r * TILE]
    grid[(r + 1) * PAD + PAD - 1] = ee ? ee[r * TILE] : center[r * TILE + last]
  }
  grid[0] = nw ? nw[last * TILE + last] : center[0]
  grid[PAD - 1] = ne ? ne[last * TILE] : center[last]
  grid[(PAD - 1) * PAD] = sw ? sw[last] : center[last * TILE]
  grid[PAD * PAD - 1] = se ? se[0] : center[last * TILE + last]
  return grid
}

/**
 * Elevation at a point, bilinearly interpolated from the cached DEM tiles.
 * Sampled at the overlay zoom by default — matches the DEM's native
 * resolution in BC.
 */
export async function elevationAt(
  lng: number,
  lat: number,
  zoom = DEM_OVERLAY_MAXZOOM,
): Promise<number | null> {
  const n = 1 << zoom
  const xf = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const tx = Math.floor(xf)
  const ty = Math.floor(yf)
  const dem = await fetchDem(zoom, tx, ty)
  if (!dem) return null
  const px = (xf - tx) * TILE - 0.5
  const py = (yf - ty) * TILE - 0.5
  const x0 = Math.min(TILE - 1, Math.max(0, Math.floor(px)))
  const y0 = Math.min(TILE - 1, Math.max(0, Math.floor(py)))
  const x1 = Math.min(TILE - 1, x0 + 1)
  const y1 = Math.min(TILE - 1, y0 + 1)
  const fx = Math.min(1, Math.max(0, px - x0))
  const fy = Math.min(1, Math.max(0, py - y0))
  const top = dem[y0 * TILE + x0] * (1 - fx) + dem[y0 * TILE + x1] * fx
  const bottom = dem[y1 * TILE + x0] * (1 - fx) + dem[y1 * TILE + x1] * fx
  return top * (1 - fy) + bottom * fy
}

function writeSlope(px: Uint8ClampedArray, o: number, slopeDeg: number) {
  for (let i = SLOPE_BANDS.length - 1; i >= 0; i--) {
    const band = SLOPE_BANDS[i]
    if (slopeDeg >= band.min) {
      px[o] = band.rgb[0]
      px[o + 1] = band.rgb[1]
      px[o + 2] = band.rgb[2]
      px[o + 3] = OVERLAY_ALPHA
      return
    }
  }
}

function writeAspect(
  px: Uint8ClampedArray,
  o: number,
  slopeDeg: number,
  dzdxEast: number,
  dzdySouth: number,
) {
  if (slopeDeg < ASPECT_MIN_SLOPE_DEG) return
  // Downslope direction as a compass bearing: east component -dz/dx(east),
  // north component +dz/dy(south).
  const bearing =
    (Math.atan2(-dzdxEast, dzdySouth) * 180) / Math.PI
  const sector = Math.round(((bearing + 360) % 360) / 45) % 8
  const { rgb } = ASPECT_SECTORS[sector]
  px[o] = rgb[0]
  px[o + 1] = rgb[1]
  px[o + 2] = rgb[2]
  px[o + 3] = OVERLAY_ALPHA
}

function computeTile(
  kind: DemOverlayKind,
  z: number,
  y: number,
  grid: Float32Array,
): ImageData {
  const img = new ImageData(TILE, TILE)
  const px = img.data
  const n = 1 << z
  for (let r = 0; r < TILE; r++) {
    // Web Mercator is conformal, so metres-per-pixel is the same in both
    // axes at a given latitude; it only varies row to row.
    const mercY = (y + (r + 0.5) / TILE) / n
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * mercY)))
    const cell = (Math.cos(lat) * 40075016.686) / (n * TILE)
    for (let c = 0; c < TILE; c++) {
      const i = (r + 1) * PAD + (c + 1)
      const a = grid[i - PAD - 1]
      const b = grid[i - PAD]
      const cc = grid[i - PAD + 1]
      const d = grid[i - 1]
      const f = grid[i + 1]
      const g = grid[i + PAD - 1]
      const h = grid[i + PAD]
      const ii = grid[i + PAD + 1]
      // Horn's method
      const dzdx = (cc + 2 * f + ii - (a + 2 * d + g)) / (8 * cell)
      const dzdy = (g + 2 * h + ii - (a + 2 * b + cc)) / (8 * cell)
      const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
      const o = (r * TILE + c) * 4
      if (kind === 'slope') writeSlope(px, o, slopeDeg)
      else writeAspect(px, o, slopeDeg, dzdx, dzdy)
    }
  }
  return img
}

function loader(kind: DemOverlayKind) {
  return async (params: RequestParameters) => {
    const m = params.url.match(/(\d+)\/(\d+)\/(\d+)/)
    if (!m) throw new Error(`Bad ${kind} tile URL: ${params.url}`)
    const z = Number(m[1])
    const x = Number(m[2])
    const y = Number(m[3])
    const grid = await paddedElevations(z, x, y)
    const canvas = new OffscreenCanvas(TILE, TILE)
    const ctx = canvas.getContext('2d')!
    if (grid) ctx.putImageData(computeTile(kind, z, y, grid), 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return { data: await blob.arrayBuffer() }
  }
}

export function registerDemProtocols() {
  maplibregl.addProtocol('slope', loader('slope'))
  maplibregl.addProtocol('aspect', loader('aspect'))
}
