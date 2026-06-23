import { useMemo, useState } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { useAuth } from '../auth/AuthContext'
import { Dia, weekdayMon } from '../lib/helpers'
import { MONTHS_PL, WEEKDAYS_PL, WEEKDAYS_PL_CO } from '../lib/constants'
import type { Client, Post, RecurringTask } from '../lib/types'
import type { TipState } from '../components/Tooltip'
import { RecurringTaskForm } from '../components/RecurringTaskForm'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Props {
  onOpenPost: (id: string) => void
  onNewPost: () => void
  onTip: (t: TipState | null) => void
}

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function CalendarView({ onOpenPost, onNewPost, onTip }: Props) {
  const { clients, posts, recurringTasks, deleteRecurringTask } = usePlanner()
  const { isAdmin, profile } = useAuth()
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [rtForm, setRtForm] = useState(false)
  const [rtToDelete, setRtToDelete] = useState<RecurringTask | null>(null)

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

  const tasksByWeekday = useMemo(() => {
    const map = new Map<number, RecurringTask[]>()
    for (const t of recurringTasks) {
      const arr = map.get(t.weekday) ?? []
      arr.push(t)
      map.set(t.weekday, arr)
    }
    return map
  }, [recurringTasks])

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const leadBlanks = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const isThisMonth = today.getFullYear() === view.y && today.getMonth() === view.m

  const cells: { day: number | null }[] = []
  for (let i = 0; i < leadBlanks; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  while (cells.length % 7 !== 0) cells.push({ day: null })

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const rtColor = (t: RecurringTask) =>
    t.client_id ? clientById.get(t.client_id)?.color ?? 'var(--accent)' : 'var(--accent)'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kalendarz <span className="acc">— publikacji</span></h1>
          <div className="tagline">
            <span>/wszyscy klienci</span>
            <span>/{MONTHS_PL[view.m].toLowerCase()} {view.y}</span>
          </div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={onNewPost}>+ Zaplanuj post</button>}
      </div>

      <div className="cal-nav">
        <button className="nav-arrow" onClick={prevMonth} aria-label="Poprzedni miesiąc">‹</button>
        <h2>{MONTHS_PL[view.m]} {view.y}</h2>
        <button className="nav-arrow" onClick={nextMonth} aria-label="Następny miesiąc">›</button>
        <div className="legend">
          {clients.map((c) => (
            <span key={c.id}><Dia color={c.color} />{c.name}</span>
          ))}
        </div>
      </div>

      <div className="cal-week">
        {WEEKDAYS_PL.map((w) => <div key={w}>{w}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={i} className="cal-day other" />
          const ds = ymd(view.y, view.m, cell.day)
          const dayPosts = postsByDay.get(ds) ?? []
          const isToday = isThisMonth && cell.day === today.getDate()
          const wd = weekdayMon(ds)
          const dayTasks = tasksByWeekday.get(wd) ?? []
          const firstClient = dayPosts.length ? clientById.get(dayPosts[0].client_id) : undefined
          const onDark = firstClient ? !firstClient.dark_text : false
          return (
            <div key={i} className={`cal-day${dayPosts.length ? ' filled' : ''}${isToday ? ' today' : ''}`}>
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
              {dayTasks.length > 0 && (
                <div className="cal-tasks">
                  {dayTasks.slice(0, 2).map((t) => (
                    <span className="cal-task" key={t.id}>
                      <Dia color={rtColor(t)} size={6} />{t.label}
                    </span>
                  ))}
                  {dayTasks.length > 2 && <span className="cal-task more">+{dayTasks.length - 2}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ZADANIA CYKLICZNE */}
      <div className="list-head" style={{ marginTop: 40 }}>
        <h3>Zadania cykliczne</h3>
        <span className="cnt">{recurringTasks.length}</span>
        <button className="btn btn-line btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setRtForm(true)}>
          + Dodaj
        </button>
      </div>
      <div>
        {recurringTasks.length === 0 && (
          <div className="muted" style={{ padding: '14px 4px' }}>Brak zadań cyklicznych.</div>
        )}
        {recurringTasks
          .slice()
          .sort((a, b) => a.weekday - b.weekday)
          .map((t) => {
            const c = t.client_id ? clientById.get(t.client_id) : null
            const canDelete = isAdmin || t.created_by === profile?.id
            return (
              <div className="rt-row" key={t.id}>
                <Dia color={rtColor(t)} size={9} />
                <div className="rt-main">
                  <span className="rt-label">{t.label}</span>
                  {t.description && <span className="rt-desc">{t.description}</span>}
                </div>
                <div className="rt-when">co {WEEKDAYS_PL_CO[t.weekday]}</div>
                <div className="rt-client">{c ? c.name : 'wszyscy'}</div>
                <div className="rt-act">
                  {canDelete ? (
                    <button className="rt-del" onClick={() => setRtToDelete(t)}>✕ usuń</button>
                  ) : (
                    <span className="rt-owner">admin</span>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {rtForm && <RecurringTaskForm onClose={() => setRtForm(false)} />}
      {rtToDelete && (
        <ConfirmDialog
          title="Usunąć zadanie cykliczne?"
          message={`„${rtToDelete.label}" zostanie usunięte z kalendarza.`}
          onConfirm={() => deleteRecurringTask(rtToDelete.id)}
          onCancel={() => setRtToDelete(null)}
        />
      )}
    </>
  )
}
