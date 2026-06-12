import { useMemo, useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { useAuth } from '../auth/AuthContext'
import { Dia, fmtDateShort } from '../lib/helpers'
import { STATUSES, PLAT_LABEL, MONTHS_PL, WEEKDAYS_PL } from '../lib/constants'
import type { Client, Post } from '../lib/types'
import type { TipState } from '../components/Tooltip'

interface Props {
  onOpenPost: (id: string) => void
  onNewPost: () => void
  onTip: (t: TipState | null) => void
}

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// poniedzialek = 0 ... niedziela = 6
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7

export function CalendarView({ onOpenPost, onNewPost, onTip }: Props) {
  const { clients, posts } = usePlanner()
  const { isAdmin } = useAuth()
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const clientById = useMemo(() => {
    const map = new Map<string, Client>()
    clients.forEach((c) => map.set(c.id, c))
    return map
  }, [clients])

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>()
    for (const p of posts) {
      const arr = map.get(p.publish_date) ?? []
      arr.push(p)
      map.set(p.publish_date, arr)
    }
    return map
  }, [posts])

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const leadBlanks = mondayIndex(new Date(view.y, view.m, 1).getDay())
  const isThisMonth = today.getFullYear() === view.y && today.getMonth() === view.m

  const cells: { day: number | null }[] = []
  for (let i = 0; i < leadBlanks; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  while (cells.length % 7 !== 0) cells.push({ day: null })

  const prevMonth = () =>
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () =>
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  // Lista najblizszych: nieopublikowane, chronologicznie
  const upcoming = useMemo(
    () =>
      posts
        .filter((p) => p.status !== 'Opublikowany')
        .sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)),
    [posts],
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            Kalendarz <span className="acc">— publikacji</span>
          </h1>
          <div className="tagline">
            <span>/wszyscy klienci</span>
            <span>
              /{MONTHS_PL[view.m].toLowerCase()} {view.y}
            </span>
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={onNewPost}>
            + Zaplanuj post
          </button>
        )}
      </div>

      <div className="cal-nav">
        <button className="nav-arrow" onClick={prevMonth} aria-label="Poprzedni miesiąc">
          ‹
        </button>
        <h2>
          {MONTHS_PL[view.m]} {view.y}
        </h2>
        <button className="nav-arrow" onClick={nextMonth} aria-label="Następny miesiąc">
          ›
        </button>
        <div className="legend">
          {clients.map((c) => (
            <span key={c.id}>
              <Dia color={c.color} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="cal-week">
        {WEEKDAYS_PL.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={i} className="cal-day other" />
          }
          const ds = ymd(view.y, view.m, cell.day)
          const dayPosts = postsByDay.get(ds) ?? []
          const isToday = isThisMonth && cell.day === today.getDate()
          const firstClient = dayPosts.length ? clientById.get(dayPosts[0].client_id) : undefined
          const onDark = firstClient ? !firstClient.dark_text : false
          return (
            <div
              key={i}
              className={`cal-day${dayPosts.length ? ' filled' : ''}${isToday ? ' today' : ''}`}
            >
              {dayPosts.length > 0 && (
                <div className="segs">
                  {dayPosts.map((p) => {
                    const c = clientById.get(p.client_id)
                    if (!c) return null
                    return (
                      <div
                        key={p.id}
                        className="seg"
                        style={{ background: c.color }}
                        onMouseEnter={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          onTip({ post: p, client: c, x: r.left, y: r.bottom })
                        }}
                        onMouseLeave={() => onTip(null)}
                        onClick={() => onOpenPost(p.id)}
                      />
                    )
                  })}
                </div>
              )}
              <span className={`num${onDark ? ' on-dark' : ''}`}>
                {isToday ? <i>{cell.day}</i> : cell.day}
              </span>
            </div>
          )
        })}
      </div>

      <div className="list-head">
        <h3>Najbliższe posty</h3>
        <span className="cnt">{upcoming.length} zaplanowanych</span>
      </div>
      <div>
        {upcoming.map((p) => {
          const c = clientById.get(p.client_id)
          const s = STATUSES[p.status]
          if (!c) return null
          return (
            <div key={p.id} className="lrow" onClick={() => onOpenPost(p.id)}>
              <div className="ldate">{fmtDateShort(p.publish_date)}</div>
              <div>
                <Dia color={c.color} />
              </div>
              <div className="ltitle">
                {p.title}
                <small>{c.name}</small>
              </div>
              <div className="lmeta hide-m">
                {p.platforms.map((x) => PLAT_LABEL[x]).join(' · ')} · {p.format}
              </div>
              <div>
                <span className={`status${s.attn ? ' attn' : ''}`}>
                  <Dia color={s.color} size={7} />
                  {p.status}
                </span>
              </div>
              <div className="go">⟶</div>
            </div>
          )
        })}
        {upcoming.length === 0 && (
          <div className="muted" style={{ padding: '15px 4px' }}>
            Brak zaplanowanych postów.
          </div>
        )}
      </div>
    </>
  )
}
