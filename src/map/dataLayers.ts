import type { RasterSourceSpecification } from 'maplibre-gl'

/**
 * Public BC government data layers. Trails/peaks/huts styling lives in
 * MapView and draws from the OpenFreeMap vector tiles directly.
 */

export interface DataLayersState {
  parks: boolean
  wildfires: boolean
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
