import { useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { PLAT_LABEL } from '../lib/constants'
import type { Platform } from '../lib/types'

const ALL_PLATFORMS: Platform[] = ['IG', 'FB', 'LI']

// Czy na danym kolorze tla czytelny jest ciemny tekst (luminancja > prog)
function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '')
  if (m.length !== 6) return false
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6
}

export function ClientForm({ onClose }: { onClose: () => void }) {
  const { createClient } = usePlanner()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#eb5d1c')
  const [platforms, setPlatforms] = useState<Platform[]>(['IG', 'FB'])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('Podaj nazwę klienta.')
    if (platforms.length === 0) return setErr('Zaznacz co najmniej jedną platformę.')
    setBusy(true)
    const e = await createClient({
      name: name.trim(),
      color,
      platforms,
      dark_text: isLightColor(color),
    })
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div>
            <h3>
              Nowy <span style={{ color: 'var(--accent)' }}>— klient</span>
            </h3>
            <div className="sub">Klient = osobna zakładka / dashboard</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="sec">
            <label className="flbl">Nazwa</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Tarasy Gąski"
              autoFocus
            />
          </div>

          <div className="sec">
            <label className="flbl">Kolor (kalendarz / zakładka)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 44, height: 36, border: '1px solid var(--line)', background: 'none', cursor: 'pointer' }}
              />
              <input
                className="field"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <span className="dia" style={{ background: color, width: 12, height: 12 }} />
            </div>
          </div>

          <div className="sec">
            <label className="flbl">Platformy</label>
            <div className="checkrow">
              {ALL_PLATFORMS.map((p) => (
                <label key={p}>
                  <input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)} />
                  {PLAT_LABEL[p]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Dodaj klienta'}
          </button>
          <button className="btn btn-line" onClick={onClose} disabled={busy}>
            Anuluj
          </button>
          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
