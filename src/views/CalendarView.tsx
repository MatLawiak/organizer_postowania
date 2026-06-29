import { useMemo, useState, type DragEvent } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { useAuth } from '../auth/AuthContext'
import {
  Dia, iso, addDays, todayMidnight, monthIndex, fmtDateShort, darkSeg, freqText,
} from '../lib/helpers'
import { MONTHS_PL, WEEKDAYS_PL, HORIZON_AHEAD_MONTHS, HORIZON_BACK_MONTHS } from '../lib/constants'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Client, Post, Series } from '../lib/types'
import type { TipState } from '../components/Tooltip'

interface Props {
  onOpenPost: (id: string) => void
  onNewPost: () => void
  onOpenSeries: (id: string) => void
  onTip: (t: TipState | null) => void
}

export function CalendarView({ onOpenPost, onNewPost, onOpenSeries, onTip }: Props) {
  const { clients, items, series, updatePostFields, deleteSeries } = usePlanner()
  const { isAdmin, profile } = useAuth()
  const today = todayMidnight()
  const todayIso = iso(today)
  const MIN_MI = monthIndex(today) - HORIZON_BACK_MONTHS
  const MAX_MI = monthIndex(today) + HORIZON_AHEAD_MONTHS

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [weekAnchor, setWeekAnchor] = useState(new Date(today))
  const [calClients, setCalClients] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [seriesToDelete, setSeriesToDelete] = useState<Series | null>(null)

  const clientById = useMemo(() => {
    const m = new Map<string, Client>(); clients.forEach((c) => m.set(c.id, c)); return m
  }, [clients])
  const postsByDay = useMemo(() => {
    const m = new Map<string, Post[]>()
    for (const p of items) { const a = m.get(p.publish_date) ?? []; a.push(p); m.set(p.publish_date, a) }
    return m
  }, [items])

  const showC = (p: Post) => calClients === null || calClients.includes(p.client_id)
  const mi = monthIndex(viewMonth)

  const move = (delta: number) => {
    if (mode === 'week') { setWeekAnchor((w) => addDays(w, delta * 7)); return }
    const next = mi + delta
    if (next < MIN_MI || next > MAX_MI) return
    setViewMonth(new Date(Math.floor(next / 12), ((next % 12) + 12) % 12, 1))
  }
  const goToday = () => { setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setWeekAnchor(new Date(today)) }
  const toggleClient = (id: string) => {
    setCalClients((prev) => {
      if (prev === null) return clients.map((c) => c.id).filter((x) => x !== id)
      if (prev.includes(id)) { const n = prev.filter((x) => x !== id); return n.length ? n : null }
      return [...prev, id]
    })
  }

  const onDrop = async (e: DragEvent, ds: string) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('dragover')
    if (!dragId) return
    const p = items.find((x) => x.id === dragId)
    if (p && !p.recur_id && p.publish_date !== ds) await updatePostFields(p, { publish_date: ds })
    setDragId(null)
  }

  const dayCell = (dateObj: Date) => {
    const ds = iso(dateObj), d = dateObj.getDate()
    const dayPosts = (postsByDay.get(ds) ?? []).filter(showC)
    const isToday = ds === todayIso
    const firstDark = dayPosts.length > 0 && darkSeg(clientById.get(dayPosts[0].client_id)?.color ?? '')
    return (
      <div key={ds} className={`cal-day${dayPosts.length ? ' filled' : ''}${isToday ? ' today' : ''}`}
        onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('dragover') }}
        onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove('dragover')}
        onDrop={(e) => onDrop(e, ds)}>
        {dayPosts.length > 0 && (
          <div className="segs">
            {dayPosts.map((p) => {
              const c = clientById.get(p.client_id); if (!c) return null
              return (
                <div key={p.id} className={`seg${darkSeg(c.color) ? ' darkmark' : ''}`} style={{ background: c.color }}
                  draggable={!p.recur_id}
                  onDragStart={() => !p.recur_id && setDragId(p.id)}
                  onMouseEnter={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onTip({ post: p, client: c, x: r.left, y: r.bottom }) }}
                  onMouseLeave={() => onTip(null)}
                  onClick={() => onOpenPost(p.id)}>
                  {p.recur_id && <span className="rmark">♻</span>}
                </div>
              )
            })}
          </div>
        )}
        <span className={`num${firstDark ? ' on-dark' : ''}`}>{isToday ? <i>{d}</i> : d}</span>
      </div>
    )
  }

  // budowa siatki
  let cells: Date[] = []
  let title = ''
  if (mode === 'week') {
    const ws = addDays(weekAnchor, -((weekAnchor.getDay() + 6) % 7))
    for (let i = 0; i < 7; i++) cells.push(addDays(ws, i))
    title = `Tydz. ${fmtDateShort(iso(ws))}–${fmtDateShort(iso(addDays(ws, 6)))}.${ws.getFullYear()}`
  } else {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth()
    title = `${MONTHS_PL[m]} ${y}`
    const lead = (new Date(y, m, 1).getDay() + 6) % 7
    const dim = new Date(y, m + 1, 0).getDate()
    cells = [
      ...Array.from({ length: lead }, () => null as unknown as Date),
      ...Array.from({ length: dim }, (_, i) => new Date(y, m, i + 1)),
    ]
    while (cells.length % 7 !== 0) cells.push(null as unknown as Date)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kalendarz <span className="acc">— publikacji</span></h1>
          <div className="tagline"><span>/{mode === 'week' ? 'widok tygodnia' : `${MONTHS_PL[viewMonth.getMonth()].toLowerCase()} ${viewMonth.getFullYear()}`}</span><span>/przeciągnij kafel, by zmienić datę</span></div>
        </div>
        <button className="btn btn-primary" onClick={onNewPost}>+ Zaplanuj post</button>
      </div>

      <div className="cal-ctrl">
        <button className="btn btn-line btn-sm" onClick={goToday}>Dziś</button>
        <button className="btn btn-line btn-sm" onClick={() => setMode((x) => (x === 'month' ? 'week' : 'month'))}>
          {mode === 'month' ? 'Widok tygodnia' : 'Widok miesiąca'}
        </button>
        <div className="cal-filter">
          <span className={`cf-chip${calClients === null ? '' : ' off'}`} onClick={() => setCalClients(null)}>Wszyscy</span>
          {clients.map((c) => (
            <span key={c.id} className={`cf-chip${calClients && !calClients.includes(c.id) ? ' off' : ''}`} onClick={() => toggleClient(c.id)}>
              <Dia color={c.color} />{c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="cal-nav">
        <button className="nav-arrow" onClick={() => move(-1)} style={mode === 'month' && mi <= MIN_MI ? { opacity: .25, pointerEvents: 'none' } : undefined}>‹</button>
        <h2>{title}</h2>
        <button className="nav-arrow" onClick={() => move(1)} style={mode === 'month' && mi >= MAX_MI ? { opacity: .25, pointerEvents: 'none' } : undefined}>›</button>
        <div className="legend">
          {clients.map((c) => <span key={c.id}><Dia color={c.color} />{c.name}</span>)}
          <span className="rtag">♻ cykliczne</span>
        </div>
      </div>

      <div className="cal-week">{WEEKDAYS_PL.map((w) => <div key={w}>{w}</div>)}</div>
      <div className={`cal-grid${mode === 'week' ? ' week' : ''}`}>
        {cells.map((d, i) => d ? dayCell(d) : <div key={`o${i}`} className="cal-day other" />)}
      </div>

      <div className="recur-head"><h3>Serie cykliczne</h3></div>
      <div>
        {series.length === 0 && <div className="rlrow" style={{ color: 'var(--ink-3)' }}><div /><div>Brak serii cyklicznych.</div><div /><div /><div /></div>}
        {series.map((s) => {
          const c = clientById.get(s.client_id); if (!c) return null
          const canDel = isAdmin || s.created_by === profile?.id
          return (
            <div key={s.id} className="rlrow" style={{ cursor: 'pointer' }} onClick={() => onOpenSeries(s.id)}>
              <div><Dia color={c.color} /></div>
              <div className="rl-name"><span className="rtag">♻</span> {s.title}{s.brief && <small>{s.brief}</small>}</div>
              <div className="rl-when">{freqText(s)}</div>
              <div className="rl-client">{c.name}</div>
              {canDel
                ? <div className="del" onClick={(e) => { e.stopPropagation(); setSeriesToDelete(s) }}>✕ usuń</div>
                : <div className="lockicon" title="Dodane przez admina">admin</div>}
            </div>
          )
        })}
      </div>

      {seriesToDelete && (
        <ConfirmDialog
          title="Usunąć serię cykliczną?"
          message={`Seria „${seriesToDelete.title}" zniknie wraz z przyszłymi wystąpieniami. Opublikowane zostają w historii.`}
          confirmLabel="Usuń serię"
          onConfirm={() => deleteSeries(seriesToDelete.id)}
          onCancel={() => setSeriesToDelete(null)}
        />
      )}
    </>
  )
}
