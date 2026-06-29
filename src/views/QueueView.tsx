import { useMemo } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort, displayStatus, isUrgent, daysFromToday } from '../lib/helpers'
import { PLAT_LABEL } from '../lib/constants'
import { UTag } from '../components/UTag'
import type { Client, Post } from '../lib/types'

export function QueueView({ onOpenPost, onNewPost }: { onOpenPost: (id: string) => void; onNewPost: () => void }) {
  const { clients, items } = usePlanner()

  const clientById = useMemo(() => {
    const m = new Map<string, Client>(); clients.forEach((c) => m.set(c.id, c)); return m
  }, [clients])

  const active = useMemo(
    () => items.filter((p) => p.status !== 'Opublikowany' && daysFromToday(p.publish_date) <= 60)
      .sort((a, b) => (a.publish_date < b.publish_date ? -1 : a.publish_date > b.publish_date ? 1 : 0)),
    [items],
  )
  const done = useMemo(
    () => items.filter((p) => p.status === 'Opublikowany').sort((a, b) => (a.publish_date > b.publish_date ? -1 : 1)).slice(0, 16),
    [items],
  )

  const Row = ({ p, isDone }: { p: Post; isDone?: boolean }) => {
    const c = clientById.get(p.client_id); if (!c) return null
    const s = displayStatus(p)
    return (
      <div className={`qrow${isDone ? ' done' : ''}${!isDone && isUrgent(p) ? ' urgent' : ''}`} onClick={() => onOpenPost(p.id)}>
        <div className="qdate">{fmtDateShort(p.publish_date)}</div>
        <div><Dia color={c.color} /></div>
        <div className="qtitle">{p.recur_id && <span className="rtag">♻</span>} {p.title}<small>{c.name}</small></div>
        <div className="qmeta hide-m">{p.platforms.map((x) => PLAT_LABEL[x]).join(' · ')} · {p.format}</div>
        <div><span className={`status${s.attn ? ' attn' : ''}`}><Dia color={s.color} size={7} />{s.label}</span></div>
        <div>{isDone ? <span className="done-badge">opublik.</span> : <UTag post={p} />}</div>
        <div className="go">⟶</div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Zaplanowane <span className="acc">— najbliższe</span></h1>
          <div className="tagline"><span>/od najbliższej daty</span><span>/0–3 dni wyróżnione</span></div>
        </div>
        <button className="btn btn-primary" onClick={onNewPost}>+ Zaplanuj post</button>
      </div>

      <div>
        {active.length === 0 && <div className="qrow" style={{ cursor: 'default', color: 'var(--ink-3)' }}>Brak zaplanowanych postów w najbliższym czasie.</div>}
        {active.map((p) => <Row key={p.id} p={p} />)}
      </div>

      {done.length > 0 && (
        <>
          <div className="qsub">Opublikowane — wyciszone</div>
          {done.map((p) => <Row key={p.id} p={p} isDone />)}
        </>
      )}
    </>
  )
}
