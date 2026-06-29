import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { fmtDateFull, freqText } from '../lib/helpers'
import { PLAT_LABEL, FREQ_OPTIONS } from '../lib/constants'
import { ConfirmDialog } from './ConfirmDialog'
import type { Frequency } from '../lib/types'

export function SeriesModal({ seriesId, onClose }: { seriesId: string; onClose: () => void }) {
  const { clients, series, updateSeries, deleteSeries } = usePlanner()
  const { isAdmin, profile } = useAuth()
  const s = series.find((x) => x.id === seriesId)
  const client = clients.find((c) => c.id === s?.client_id)

  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState(s?.title ?? '')
  const [brief, setBrief] = useState(s?.brief ?? '')
  const [freq, setFreq] = useState<Frequency>(s?.frequency ?? 'weekly')
  const [days, setDays] = useState(s?.interval_days ?? 7)
  const [endDate, setEndDate] = useState(s?.end_date ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!s || !client) return null
  const canManage = isAdmin || s.created_by === profile?.id

  async function save() {
    if (!s) return
    setErr(null); setBusy(true)
    const interval = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : freq === 'monthly' ? 0 : Math.min(30, Math.max(1, days))
    const e = await updateSeries(s.id, { title: title.trim() || s.title, brief: brief.trim() || null, frequency: freq, interval_days: interval, end_date: endDate || null })
    setBusy(false)
    if (e) setErr(e); else setEdit(false)
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div><h3><span className="rtag">♻</span> {s.title}</h3>
            <div className="sub">{client.name} · seria cykliczna · {freqText(s)}</div></div>
          <button className="x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        {!edit ? (
          <>
            <div className="modal-body">
              <div className="sec"><div className="meta-chips">
                <span>{s.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}</span><span>·</span><span>{s.format}</span><span>·</span><span className="rtag">{freqText(s)}</span>
              </div></div>
              <div className="sec"><div className="sec-label">Brief / wytyczne</div><div className="plain">{s.brief || '—'}</div></div>
              <div className="sec"><div className="sec-label">Powtarzanie</div>
                <div className="plain">Start: {fmtDateFull(s.start_date)} · {freqText(s)}{s.end_date ? ` · do ${fmtDateFull(s.end_date)}` : ' · bez daty końca'}.<br />
                  Wystąpienia (♻) tworzą się automatycznie i <b>nie wymagają akceptacji</b> — wystarczy je opublikować.</div></div>
            </div>
            <div className="modal-actions">
              {canManage
                ? <><button className="btn btn-line" onClick={() => setEdit(true)}>Edytuj serię</button>
                    <button className="btn btn-line" onClick={() => setConfirmDel(true)}>Usuń serię</button></>
                : <span className="note" style={{ marginLeft: 0 }}>Serię dodał administrator — nie możesz jej edytować/usunąć.</span>}
            </div>
          </>
        ) : (
          <>
            <div className="modal-body" style={{ paddingTop: 18 }}>
              <div className="frow"><label>Nazwa</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="frow"><label>Brief / wytyczne</label><textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} /></div>
              <div className="inline-2">
                <div className="frow"><label>Częstotliwość</label>
                  <select value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>{FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                {freq === 'days' && <div className="frow"><label>Co ile dni</label><input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>}
              </div>
              <div className="frow"><label>Powtarzaj do <span className="hint">— pusto = bez końca</span></label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
              <button className="btn btn-line" onClick={() => setEdit(false)} disabled={busy}>Anuluj</button>
              {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
            </div>
          </>
        )}
      </div>

      {confirmDel && (
        <ConfirmDialog
          title="Usunąć serię cykliczną?"
          message={`Seria „${s.title}" zniknie wraz z przyszłymi wystąpieniami. Opublikowane zostają w historii.`}
          confirmLabel="Usuń serię"
          onConfirm={async () => { const e = await deleteSeries(s.id); if (!e) onClose(); return e }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
