import type { LngLat } from './geo'

export interface SavedRoute {
  id: string
  name: string
  coords: LngLat[]
  savedAt: string
}

const KEY = 'arkenterra.routes.v1'

export function loadRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(routes: SavedRoute[]): SavedRoute[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(routes))
  } catch {
    // storage full or unavailable — the in-memory list still works
  }
  return routes
}

export function saveRoute(name: string, coords: LngLat[]): SavedRoute[] {
  const route: SavedRoute = {
    id: crypto.randomUUID(),
    name,
    coords,
    savedAt: new Date().toISOString(),
  }
  return persist([route, ...loadRoutes()])
}

export function deleteRoute(id: string): SavedRoute[] {
  return persist(loadRoutes().filter((r) => r.id !== id))
}
