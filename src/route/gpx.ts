export interface GPXPoint {
  lng: number
  lat: number
  ele: number
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildGPX(name: string, points: GPXPoint[]): string {
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ArkenTerra" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
}

export function downloadGPX(name: string, gpx: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }))
  a.download = `${name.replace(/[^\w\- ]+/g, '').trim() || 'route'}.gpx`
  a.click()
  URL.revokeObjectURL(a.href)
}
