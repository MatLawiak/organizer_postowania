import { useEffect, useMemo, useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { FORMATS, PLAT_LABEL, FREQ_OPTIONS } from '../lib/constants'
import { todayYmd } from '../lib/helpers'
import type { Platform, PostFormat, Frequency } from '../lib/types'

export function PostForm({ presetClientId, onClose, onGoCalendar }: {
  presetClientId: string; onClose: () => void; onGoCalendar: () => void
}) {
  const { clients, createPost, createSeries } = usePlanner()
  const [clientId, setClientId] = useState(presetClientId || clients[0]?.id || '')
  const [date, setDate] = useState(todayYmd())
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [format, setFormat] = useState<PostFormat>('Post')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [recur, setRecur] = useState(false)
  const [freq, setFreq] = useState<Frequency>('weekly')
  const [days, setDays] = useState(7)
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])
  useEffect(() => { setPlatforms((prev) => prev.filter((p) => client?.platforms.includes(p))) }, [client])

  const togglePlat = (p: Platform) => setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])

  async function submit() {
    setErr(null)
    if (!clientId) return setErr('Wybierz klienta.')
    if (!title.trim()) return setErr('Podaj tytuł roboczy.')
    if (platforms.length === 0) return setErr('Zaznacz przynajmniej jedną platformę.')
    setBusy(true)
    let e: string | null
    if (recur) {
      const interval = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : freq === 'monthly' ? 0 : Math.min(30, Math.max(1, days))
      e = await createSeries({ client_id: clientId, title: title.trim(), format, platforms, brief: brief.trim(), frequency: freq, interval_days: interval, start_date: date, end_date: endDate || null })
    } else {
      e = await createPost({ client_id: clientId, publish_date: date, platforms, format, title: title.trim(), brief: brief.trim(), graphic_url: '' })
    }
    setBusy(false)
    if (e) setErr(e); else onGoCalendar()
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div><h3>Nowy post</h3><div className="sub">Zaplanuj publikację</div></div>
          <button className="x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>
        <div className="modal-body" style={{ paddingTop: 24 }}>
          <div className="inline-2">
            <div className="frow"><label>Klient</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="frow"><label>Data {recur ? 'startu' : 'publikacji'}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="frow"><label>Platformy</label>
            <div className="checkrow">
              {(client?.platforms ?? []).map((p) => (
                <label key={p}><input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlat(p)} />{PLAT_LABEL[p]}</label>
              ))}
              {(!client || client.platforms.length === 0) && <span className="muted">Klient nie ma platform.</span>}
            </div>
          </div>
          <div className="inline-2">
            <div className="frow"><label>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as PostFormat)}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="frow"><label>Tytuł roboczy</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Case study — Tarasy Gąski" /></div>
          </div>
          <div className="frow"><label>Brief / wytyczne <span className="hint">— opcjonalnie</span></label>
            <textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Co ma zawierać post, materiały, CTA…" /></div>

          <label className="checkline" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={recur} onChange={(e) => setRecur(e.target.checked)} /> To jest zadanie cykliczne (powtarza się)
          </label>
          {recur && (
            <div className="recur-opts show">
              <div className="inline-2">
                <div className="frow"><label>Częstotliwość</label>
                  <select value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
                    {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select></div>
                {freq === 'days' && <div className="frow"><label>Co ile dni (1–30)</label>
                  <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>}
              </div>
              <div className="frow" style={{ marginTop: 12 }}><label>Powtarzaj do <span className="hint">— pusto = bez końca</span></label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Wystąpienia utworzą się automatycznie (♻) i <b>nie wymagają akceptacji</b>.</div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Zapisywanie…' : (recur ? 'Utwórz serię' : 'Zaplanuj')}</button>
          <button className="btn btn-line" onClick={onClose} disabled={busy}>Anuluj</button>
          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
