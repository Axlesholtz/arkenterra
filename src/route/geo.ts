export type LngLat = [number, number]

const EARTH_RADIUS = 6371000

export function haversine(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLng = (b[0] - a[0]) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(s))
}

export function routeLength(coords: LngLat[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i])
  return total
}

export interface DensePoint {
  lng: number
  lat: number
  dist: number
}

/** Interpolate points along the route, roughly evenly spaced. */
export function densifyRoute(coords: LngLat[], targetSamples = 400): DensePoint[] {
  const total = routeLength(coords)
  const spacing = Math.max(20, total / targetSamples)
  const out: DensePoint[] = [{ lng: coords[0][0], lat: coords[0][1], dist: 0 }]
  let acc = 0
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = coords[i - 1]
    const [bx, by] = coords[i]
    const seg = haversine(coords[i - 1], coords[i])
    const n = Math.max(1, Math.ceil(seg / spacing))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      out.push({ lng: ax + (bx - ax) * t, lat: ay + (by - ay) * t, dist: acc + seg * t })
    }
    acc += seg
  }
  return out
}

// Google polyline encoding (precision 5) — compact route representation for
// shareable URLs.

function encodeSigned(v: number): string {
  let value = v < 0 ? ~(v << 1) : v << 1
  let s = ''
  while (value >= 0x20) {
    s += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>>= 5
  }
  return s + String.fromCharCode(value + 63)
}

export function encodePolyline(coords: LngLat[]): string {
  let out = ''
  let prevLat = 0
  let prevLng = 0
  for (const [lng, lat] of coords) {
    const latE = Math.round(lat * 1e5)
    const lngE = Math.round(lng * 1e5)
    out += encodeSigned(latE - prevLat) + encodeSigned(lngE - prevLng)
    prevLat = latE
    prevLng = lngE
  }
  return out
}

export function decodePolyline(str: string): LngLat[] {
  const out: LngLat[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0
      let shift = 0
      let b: number
      do {
        b = str.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    out.push([lng / 1e5, lat / 1e5])
  }
  return out
}
