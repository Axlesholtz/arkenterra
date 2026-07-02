import { useEffect, useState } from 'react'
import { elevationAt } from '../map/demProtocol'
import { densifyRoute, type LngLat } from './geo'

export interface ProfileSample {
  lng: number
  lat: number
  dist: number
  ele: number
}

export interface RouteStats {
  distance: number
  gain: number
  loss: number
  minEle: number
  maxEle: number
}

export interface RouteProfile {
  samples: ProfileSample[]
  stats: RouteStats
}

/**
 * Densifies the route (~400 samples), looks up elevations from the shared
 * DEM tile cache, and derives distance/gain/loss stats. Debounced so vertex
 * drags don't resample on every mousemove.
 */
export function useRouteProfile(coords: LngLat[]): RouteProfile | null {
  const [profile, setProfile] = useState<RouteProfile | null>(null)

  useEffect(() => {
    if (coords.length < 2) {
      setProfile(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const pts = densifyRoute(coords)
      const raw = await Promise.all(pts.map((p) => elevationAt(p.lng, p.lat)))
      if (cancelled) return

      // Fill gaps, then a light 3-sample smooth so ~20 m DEM noise doesn't
      // inflate the gain/loss totals.
      const eles = new Float64Array(raw.length)
      let prev = raw.find((e) => e !== null) ?? 0
      for (let i = 0; i < raw.length; i++) {
        prev = raw[i] ?? prev
        eles[i] = prev
      }
      const smooth = eles.map((_, i) => {
        const a = eles[Math.max(0, i - 1)]
        const b = eles[i]
        const c = eles[Math.min(eles.length - 1, i + 1)]
        return (a + b + c) / 3
      })

      let gain = 0
      let loss = 0
      let minEle = Infinity
      let maxEle = -Infinity
      for (let i = 0; i < smooth.length; i++) {
        minEle = Math.min(minEle, smooth[i])
        maxEle = Math.max(maxEle, smooth[i])
        if (i > 0) {
          const d = smooth[i] - smooth[i - 1]
          if (d > 0) gain += d
          else loss -= d
        }
      }
      setProfile({
        samples: pts.map((p, i) => ({ ...p, ele: smooth[i] })),
        stats: {
          distance: pts[pts.length - 1].dist,
          gain,
          loss,
          minEle,
          maxEle,
        },
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [coords])

  return profile
}
