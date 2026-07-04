import type { RasterDEMSourceSpecification, RasterSourceSpecification } from 'maplibre-gl'

export type BasemapId = 'topo' | 'satellite'

/** Vector topo basemap — free, keyless. */
export const TOPO_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * Global elevation tiles (Terrarium encoding) from the public AWS Open Data
 * bucket — free, keyless. Native detail runs out around z15 (~30 m in BC).
 */
export const TERRARIUM_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen/AWS</a>'

/**
 * Terrain and hillshade need separate raster-dem sources: MapLibre renders
 * artifacts when one source backs both.
 */
export function terrainSource(): RasterDEMSourceSpecification {
  return {
    type: 'raster-dem',
    tiles: [TERRARIUM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    attribution: TERRAIN_ATTRIBUTION,
  }
}

export function hillshadeSource(): RasterDEMSourceSpecification {
  return {
    type: 'raster-dem',
    tiles: [TERRARIUM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
  }
}

/**
 * Satellite imagery. With a MapTiler key (VITE_MAPTILER_KEY in .env.local)
 * you get crisp aerial imagery; without one we fall back to EOX Sentinel-2
 * cloudless — keyless and BC-wide, but soft (10 m) when zoomed in.
 */
export function satelliteSource(): RasterSourceSpecification {
  const key = import.meta.env.VITE_MAPTILER_KEY as string | undefined
  if (key) {
    return {
      type: 'raster',
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`],
      tileSize: 512,
      maxzoom: 20,
      attribution:
        'Imagery © <a href="https://www.maptiler.com/">MapTiler</a>',
    }
  }
  return {
    type: 'raster',
    tiles: [
      'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
    ],
    tileSize: 256,
    maxzoom: 14,
    attribution:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX</a> (CC BY-NC-SA 4.0)',
  }
}

/** Opening view: Garibaldi Provincial Park, looking north toward Black Tusk. */
export const INITIAL_VIEW = {
  center: [-123.05, 49.895] as [number, number],
  zoom: 11.8,
  pitch: 70,
  bearing: -25,
}

export const TERRAIN_EXAGGERATION = 1.2
