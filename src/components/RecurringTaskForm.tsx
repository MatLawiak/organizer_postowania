import { useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { WEEKDAYS_PL_FULL } from '../lib/constants'

export function RecurringTaskForm({
  presetClientId,
  onClose,
}: {
  presetClientId?: string | null
  onClose: () => void
}) {
  const { clients, createRecurringTask } = usePlanner()
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [weekday, setWeekday] = useState(2) // domyslnie sroda
  const [clientId, setClientId] = useState<string>(presetClientId ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (!label.trim()) return setErr('Podaj nazwę zadania.')
    setBusy(true)
    const e = await createRecurringTask({
      client_id: clientId || null,
      label: label.trim(),
      description: description.trim() || null,
      weekday,
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
            <h3>Nowe <span style={{ color: 'var(--accent)' }}>— zadanie cykliczne</span></h3>
            <div className="sub">Powtarza się co tydzień w wybrany dzień</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        <div className="modal-body">
          <div className="sec">
            <label className="flbl">Nazwa</label>
            <input className="field" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="np. Relacja, Newsletter, Podbicie postów" autoFocus />
          </div>
          <div className="sec">
            <label className="flbl">Opis <span className="opt-hint" style={{ color: 'var(--gray-l)' }}>— o co chodzi (opcjonalnie)</span></label>
            <textarea className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis cyklu" />
          </div>
          <div className="form-grid">
            <div>
              <label className="flbl">Dzień tygodnia</label>
              <select className="field" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS_PL_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="flbl">Klient <span className="opt-hint" style={{ color: 'var(--gray-l)' }}>— opcjonalnie</span></label>
              <select className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Ogólne (wszyscy)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Dodaj zadanie'}
          </button>
          <button className="btn btn-line" onClick={onClose} disabled={busy}>Anuluj</button>
          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
