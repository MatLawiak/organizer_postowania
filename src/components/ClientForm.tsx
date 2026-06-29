import { useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { PLAT_LABEL, ALL_PLATFORMS, PALETTE } from '../lib/constants'
import { isLightColor } from '../lib/helpers'
import type { Platform } from '../lib/types'

export function ClientForm({ editId, onClose, onCreated }: {
  editId: string | null; onClose: () => void; onCreated: (id: string) => void
}) {
  const { clients, createClient, updateClient } = usePlanner()
  const editing = editId ? clients.find((c) => c.id === editId) ?? null : null

  const [name, setName] = useState(editing?.name ?? '')
  const [color, setColor] = useState(editing?.color ?? PALETTE[0])
  const [platforms, setPlatforms] = useState<Platform[]>(editing?.platforms ?? ['IG', 'FB'])
  const [note, setNote] = useState(editing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (p: Platform) => setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('Podaj nazwę klienta.')
    if (platforms.length === 0) return setErr('Zaznacz przynajmniej jedną platformę.')
    setBusy(true)
    if (editing) {
      const e = await updateClient(editing.id, { name: name.trim(), color, dark_text: isLightColor(color), platforms, note: note.trim() || null })
      setBusy(false)
      if (e) setErr(e); else onClose()
    } else {
      const r = await createClient({ name: name.trim(), color, platforms, dark_text: isLightColor(color), note: note.trim() })
      setBusy(false)
      if (r.error) setErr(r.error); else if (r.id) onCreated(r.id); else onClose()
    }
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div><h3>{editing ? 'Edytuj klienta' : 'Nowy klient'}</h3>
            <div className="sub">{editing ? 'Popraw dane klienta' : 'Dodaj nowy dashboard klienta'}</div></div>
          <button className="x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>
        <div className="modal-body" style={{ paddingTop: 24 }}>
          <div className="frow"><label>Nazwa</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Tarasy Pociejewo" autoFocus /></div>
          <div className="frow"><label>Kolor (oznaczenie w kalendarzu)</label>
            <div className="swatches">
              {PALETTE.map((col) => (
                <span key={col} className={`swatch${col === color ? ' sel' : ''}`} style={{ background: col }} onClick={() => setColor(col)} />
              ))}
            </div></div>
          <div className="frow"><label>Platformy</label>
            <div className="checkrow">
              {ALL_PLATFORMS.map((p) => <label key={p}><input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)} />{PLAT_LABEL[p]}</label>)}
            </div></div>
          <div className="frow"><label>Opis / notatka <span className="hint">— opcjonalnie</span></label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Krótki opis, branża, ważne wytyczne…" /></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Zapisywanie…' : (editing ? 'Zapisz' : 'Dodaj klienta')}</button>
          <button className="btn btn-line" onClick={onClose} disabled={busy}>Anuluj</button>
          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
