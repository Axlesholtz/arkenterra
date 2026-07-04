# ArkenTerra

3D terrain maps for the BC backcountry, in the browser. Loosely affiliated
with ArkenMap (iOS offline topo maps).

**Live: <https://axlesholtz.github.io/arkenterra/>**

Free-flying 3D terrain with switchable satellite/topo basemaps. Planned:
slope-angle and aspect overlays computed client-side from elevation tiles,
route drawing with elevation profiles, and GPX export.

## Stack

- React + TypeScript + Vite, fully static — no backend, no API keys required
- [MapLibre GL JS](https://maplibre.org/) with `raster-dem` 3D terrain
- Elevation: AWS Open Data Terrarium tiles (Mapzen), keyless
- Topo basemap: [OpenFreeMap](https://openfreemap.org/) Liberty style, keyless
- Satellite: EOX Sentinel-2 cloudless (keyless, 10 m) by default; drop a
  MapTiler key in `.env.local` as `VITE_MAPTILER_KEY=...` for crisp imagery

## Develop

```sh
npm install
npm run dev
```

## Roadmap

1. ✅ 3D terrain over BC, satellite/topo switching, smooth navigation
2. ✅ Slope-angle + aspect overlays, computed client-side from DEM tiles
   via custom `slope://` / `aspect://` protocols (Horn gradient, avalanche
   slope bands, no server pipeline). Still to come: contours
3. ✅ Route drawing (click to add, drag to adjust, right-click to delete),
   elevation profile with distance/gain/loss stats, GPX export, saved
   routes in localStorage, shareable URLs (route polyline-encoded in the
   hash alongside the camera)
4. ✅ Contour lines in topo mode ([maplibre-contour](https://github.com/onthegomap/maplibre-contour),
   computed in a web worker from the same elevation tiles)
5. ✅ Open data layers: trails/peaks/huts styled from the OpenFreeMap tiles;
   BC parks & rec sites and current wildfires (DataBC WMS)
6. Later: light backend (accounts, saved/shared routes), community content

## Deploy

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.
