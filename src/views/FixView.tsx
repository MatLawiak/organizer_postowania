import { useMemo } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort, needsFix } from '../lib/helpers'
import type { Client } from '../lib/types'

export function FixView({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const { clients, items } = usePlanner()
  const clientById = useMemo(() => {
    const m = new Map<string, Client>(); clients.forEach((c) => m.set(c.id, c)); return m
  }, [clients])

  const list = useMemo(
    () => items.filter(needsFix).sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)),
    [items],
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Do poprawy <span className="acc">— uwagi</span></h1>
          <div className="tagline"><span>/posty odesłane przez Wojciecha</span></div>
        </div>
      </div>
      <div>
        {list.length === 0 && <div className="qrow" style={{ cursor: 'default', color: 'var(--ink-3)' }}>Nic nie czeka na poprawę — super!</div>}
        {list.map((p) => {
          const c = clientById.get(p.client_id); if (!c) return null
          const comments = p.post_comments ?? []
          return (
            <div key={p.id} className="qrow urgent" onClick={() => onOpenPost(p.id)}>
              <div className="qdate">{fmtDateShort(p.publish_date)}</div>
              <div><Dia color={c.color} /></div>
              <div className="qtitle">{p.title}<small>{c.name}</small></div>
              <div className="qmeta hide-m">{comments.map((cm) => `„${cm.body}”`).join('  ')}</div>
              <div><span className="status attn"><Dia color="#eb5d1c" size={7} />Do poprawek</span></div>
              <div /><div className="go">⟶</div>
            </div>
          )
        })}
      </div>
    </>
  )
}
