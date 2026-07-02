import type { SavedRoute } from './store'

interface RoutePanelProps {
  drawing: boolean
  hasRoute: boolean
  canExport: boolean
  name: string
  copied: boolean
  saved: SavedRoute[]
  onToggleDraw: () => void
  onClear: () => void
  onSave: () => void
  onExport: () => void
  onShare: () => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onNameChange: (name: string) => void
}

export default function RoutePanel({
  drawing,
  hasRoute,
  canExport,
  name,
  copied,
  saved,
  onToggleDraw,
  onClear,
  onSave,
  onExport,
  onShare,
  onLoad,
  onDelete,
  onNameChange,
}: RoutePanelProps) {
  return (
    <div className="route-panel">
      <div className="route-actions">
        <button className={drawing ? 'active' : ''} onClick={onToggleDraw}>
          {drawing ? 'Finish' : hasRoute ? 'Extend' : 'Draw route'}
        </button>
        {hasRoute && <button onClick={onClear}>Clear</button>}
      </div>
      {drawing && (
        <p className="route-hint">
          Click the map to add points · Esc or double-click to finish ·
          Backspace undoes
        </p>
      )}
      {hasRoute && (
        <>
          <input
            className="route-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Route name"
          />
          <div className="route-actions">
            <button onClick={onSave}>Save</button>
            <button onClick={onExport} disabled={!canExport}>
              GPX
            </button>
            <button onClick={onShare}>{copied ? 'Copied!' : 'Share'}</button>
          </div>
          {!drawing && (
            <p className="route-hint">
              Drag points to adjust · right-click a point to delete
            </p>
          )}
        </>
      )}
      {saved.length > 0 && (
        <div className="saved-routes">
          <span className="saved-title">Saved routes</span>
          {saved.map((r) => (
            <div key={r.id} className="saved-row">
              <button className="saved-name" onClick={() => onLoad(r.id)}>
                {r.name}
              </button>
              <button
                className="saved-delete"
                aria-label={`Delete ${r.name}`}
                onClick={() => onDelete(r.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
