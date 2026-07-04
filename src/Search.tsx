import { useEffect, useRef, useState } from 'react'

export interface SearchResult {
  name: string
  detail: string
  lng: number
  lat: number
  /** [minLng, maxLat, maxLng, minLat] when Photon knows the feature's size */
  extent?: [number, number, number, number]
}

// Bias results toward BC — the app's home turf
const PHOTON = 'https://photon.komoot.io/api/?limit=6&lang=en&lat=51.5&lon=-122.5'

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    city?: string
    county?: string
    state?: string
    country?: string
    osm_value?: string
    extent?: [number, number, number, number]
  }
}

async function geocode(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const res = await fetch(`${PHOTON}&q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { features: PhotonFeature[] }
  return data.features
    .filter((f) => f.properties.name)
    .map((f) => ({
      name: f.properties.name!,
      detail: [
        f.properties.osm_value?.replace(/_/g, ' '),
        f.properties.city ?? f.properties.county,
        f.properties.state,
        f.properties.country,
      ]
        .filter(Boolean)
        .join(' · '),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      extent: f.properties.extent,
    }))
}

export default function Search({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const found = await geocode(query.trim(), controller.signal)
        setResults(found)
        setHighlight(0)
        setOpen(true)
      } catch {
        // aborted or offline — keep whatever is showing
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const select = (r: SearchResult) => {
    onSelect(r)
    setQuery(r.name)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search places…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search places"
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={`${r.name}-${r.lng}-${r.lat}`}>
              <button
                className={i === highlight ? 'highlight' : ''}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(r)}
              >
                <span className="search-name">{r.name}</span>
                {r.detail && <span className="search-detail">{r.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
