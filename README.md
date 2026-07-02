# ArkenTerra

3D terrain maps for the BC backcountry, in the browser. Working title — loosely
affiliated with ArkenMap (iOS offline topo maps).

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
3. Route drawing, elevation profile, distance/gain stats, GPX export,
   localStorage persistence + shareable URL routes
4. Later: light backend (accounts, saved/shared routes), community content
