import { useMemo, useState, type ReactNode } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { Dia, parseISO, todayMidnight } from '../lib/helpers'
import { MONTHS_PL, STATUSES, PLAT_LABEL, FORMATS } from '../lib/constants'
import type { Post, PostStatus, PostFormat, Platform } from '../lib/types'

export function StatsView() {
  const { clients, items } = usePlanner()
  const today = todayMidnight()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const inMonth = (y: number, m: number) => {
    const f = new Date(y, m, 1), t = new Date(y, m + 1, 0)
    return items.filter((p) => { const d = parseISO(p.publish_date); return d >= f && d <= t })
  }

  const data = useMemo(() => inMonth(view.y, view.m), [items, view])
  const prev = useMemo(() => { const d = new Date(view.y, view.m - 1, 1); return inMonth(d.getFullYear(), d.getMonth()).length }, [items, view])

  const total = data.length
  const byFormat = (f: PostFormat) => data.filter((i) => i.format === f).length
  const byStatus = (s: PostStatus) => data.filter((i) => i.status === s).length
  const byPlat = (pl: Platform) => data.filter((i) => i.platforms.includes(pl)).length
  const activeClients = new Set(data.map((i) => i.client_id)).size
  const diff = total - prev

  const prevM = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextM = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const bar = (label: ReactNode, n: number, max: number, color: string, key: string) => (
    <div className="statrow" key={key}>
      <div>{label}</div>
      <div className="bar"><span style={{ width: `${Math.round((n / Math.max(1, max)) * 100)}%`, background: color }} /></div>
      <div className="cnt">{n}</div>
    </div>
  )

  function exportCSV() {
    const rows: string[][] = [['Data', 'Klient', 'Tytul', 'Format', 'Platformy', 'Status', 'Cykliczny']]
    const cName = (id: string) => clients.find((c) => c.id === id)?.name ?? ''
    data.slice().sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)).forEach((p: Post) =>
      rows.push([p.publish_date, cName(p.client_id), p.title, p.format, p.platforms.map((x) => PLAT_LABEL[x]).join(' '), p.status, p.recur_id ? 'tak' : 'nie']))
    const csv = rows.map((r) => r.map((x) => `"${String(x).split('"').join('""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `statystyki-${MONTHS_PL[view.m].toLowerCase()}-${view.y}.csv`
    a.click()
  }

  const maxClient = Math.max(1, ...clients.map((c) => data.filter((i) => i.client_id === c.id).length))
  const maxFmt = Math.max(1, ...FORMATS.map(byFormat))
  const maxStat = Math.max(1, ...(Object.keys(STATUSES) as PostStatus[]).map(byStatus))
  const plats: Platform[] = ['IG', 'FB', 'LI']
  const maxPlat = Math.max(1, ...plats.map(byPlat))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Statystyki <span className="acc">— {MONTHS_PL[view.m].toLowerCase()} {view.y}</span></h1>
          <div className="tagline"><span>/podsumowanie miesiąca</span></div>
        </div>
      </div>

      <div className="cal-nav" style={{ borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
        <button className="nav-arrow" onClick={prevM}>‹</button>
        <h2>{MONTHS_PL[view.m]} {view.y}</h2>
        <button className="nav-arrow" onClick={nextM}>›</button>
        <button className="btn btn-line btn-sm" style={{ marginLeft: 'auto' }} onClick={exportCSV}>⤓ Eksport CSV</button>
      </div>

      <div className="statline big">
        <span><b>{total}</b> pozycji łącznie {diff !== 0 && <span className={`stat-delta ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '▲ +' : '▼ '}{diff} m/m</span>}</span>
        <span><b>{byFormat('Post')}</b> posty</span>
        <span><b>{byFormat('Rolka')}</b> rolki</span>
        <span><b>{byFormat('Karuzela')}</b> karuzele</span>
        <span><b>{byFormat('Story')}</b> story</span>
        <span className="acc"><b>{activeClients}</b> aktywnych klientów</span>
      </div>

      <h3 className="stat-h">Wg klienta</h3>
      {data.length === 0 && <div style={{ color: 'var(--ink-3)', padding: '10px 0' }}>Brak pozycji w tym miesiącu.</div>}
      {clients.map((c) => { const n = data.filter((i) => i.client_id === c.id).length; return n ? bar(<><Dia color={c.color} />{c.name}</>, n, maxClient, c.color, c.id) : null })}

      <h3 className="stat-h">Wg formatu</h3>
      {FORMATS.map((f) => bar(f, byFormat(f), maxFmt, 'var(--accent)', f))}

      <h3 className="stat-h">Wg statusu</h3>
      {(Object.keys(STATUSES) as PostStatus[]).map((st) => bar(<><Dia color={STATUSES[st].color} />{st}</>, byStatus(st), maxStat, STATUSES[st].color, st))}

      <h3 className="stat-h">Wg platformy</h3>
      {plats.map((pl) => bar(PLAT_LABEL[pl], byPlat(pl), maxPlat, 'var(--gray)', pl))}
    </>
  )
}
