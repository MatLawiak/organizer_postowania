import { useEffect, useMemo, useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { FORMATS, PLAT_LABEL } from '../lib/constants'
import type { Platform, PostFormat } from '../lib/types'

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NewPostForm({
  presetClientId,
  onClose,
}: {
  presetClientId: string
  onClose: () => void
}) {
  const { clients, createPost } = usePlanner()
  const [clientId, setClientId] = useState(presetClientId || clients[0]?.id || '')
  const [date, setDate] = useState(todayYmd())
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [format, setFormat] = useState<PostFormat>('Post')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [graphic, setGraphic] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])

  // Po zmianie klienta — wyczysc platformy spoza jego zakresu
  useEffect(() => {
    setPlatforms((prev) => prev.filter((p) => client?.platforms.includes(p)))
  }, [client])

  function togglePlat(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function submit() {
    setErr(null)
    if (!clientId) return setErr('Wybierz klienta.')
    if (!title.trim()) return setErr('Podaj tytuł roboczy.')
    if (platforms.length === 0) return setErr('Zaznacz co najmniej jedną platformę.')
    setBusy(true)
    const e = await createPost({
      client_id: clientId,
      publish_date: date,
      platforms,
      format,
      title: title.trim(),
      brief: brief.trim(),
      graphic_url: graphic.trim(),
    })
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>
              Nowy <span style={{ color: 'var(--accent)' }}>— post</span>
            </h3>
            <div className="sub">Status startowy: Zaplanowany</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div>
              <label className="flbl">Klient</label>
              <select className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flbl">Data publikacji</label>
              <input
                className="field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="full">
              <label className="flbl">Platformy</label>
              <div className="checkrow">
                {(client?.platforms ?? []).map((p) => (
                  <label key={p}>
                    <input
                      type="checkbox"
                      checked={platforms.includes(p)}
                      onChange={() => togglePlat(p)}
                    />
                    {PLAT_LABEL[p]}
                  </label>
                ))}
                {(!client || client.platforms.length === 0) && (
                  <span className="muted">Klient nie ma przypisanych platform.</span>
                )}
              </div>
            </div>

            <div>
              <label className="flbl">Format</label>
              <select
                className="field"
                value={format}
                onChange={(e) => setFormat(e.target.value as PostFormat)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flbl">Tytuł roboczy</label>
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Case study: Tarasy Gąski"
              />
            </div>

            <div className="full">
              <label className="flbl">Brief / wytyczne</label>
              <textarea
                className="field"
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Wytyczne dla pracownika, linki do materiałów…"
              />
            </div>

            <div className="full">
              <label className="flbl">
                Link do materiałów <span className="opt-hint" style={{ color: 'var(--gray)' }}>— opcjonalnie</span>
              </label>
              <input
                className="field"
                value={graphic}
                onChange={(e) => setGraphic(e.target.value)}
                placeholder="Link do Canvy / Drive"
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Zaplanuj post'}
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
