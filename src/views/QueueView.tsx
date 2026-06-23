import { useMemo } from 'react'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort, displayStatus } from '../lib/helpers'
import { PLAT_LABEL } from '../lib/constants'
import { TermBadge } from '../components/TermBadge'
import type { Client, Post } from '../lib/types'

export function QueueView({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const { clients, posts } = usePlanner()

  const clientById = useMemo(() => {
    const m = new Map<string, Client>()
    clients.forEach((c) => m.set(c.id, c))
    return m
  }, [clients])

  const queue = useMemo(
    () =>
      posts
        .filter((p) => p.status !== 'Opublikowany')
        .sort((a, b) => (a.publish_date < b.publish_date ? -1 : a.publish_date > b.publish_date ? 1 : 0)),
    [posts],
  )

  const published = useMemo(
    () =>
      posts
        .filter((p) => p.status === 'Opublikowany')
        .sort((a, b) => (a.publish_date > b.publish_date ? -1 : 1)),
    [posts],
  )

  const Row = ({ post, dim }: { post: Post; dim?: boolean }) => {
    const c = clientById.get(post.client_id)
    if (!c) return null
    const s = displayStatus(post)
    return (
      <div className={`qrow${dim ? ' dim' : ''}`} onClick={() => onOpenPost(post.id)}>
        <div className="ldate">{fmtDateShort(post.publish_date)}</div>
        <div><Dia color={c.color} /></div>
        <div className="ltitle">
          {post.title}
          <small>{c.name}</small>
        </div>
        <div className="lmeta hide-m">
          {post.platforms.map((x) => PLAT_LABEL[x]).join(' · ')} · {post.format}
        </div>
        <div className="qstatus">
          <span className={`status${s.attn ? ' attn' : ''}`}>
            <Dia color={s.color} size={7} />
            {s.label}
          </span>
          <TermBadge post={post} />
        </div>
        <div className="go">⟶</div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Do <span className="acc">publikacji</span></h1>
          <div className="tagline"><span>/wszyscy klienci</span><span>/kolejka</span></div>
        </div>
      </div>

      <div className="list-head">
        <h3>Kolejka</h3>
        <span className="cnt">{queue.length} do publikacji</span>
      </div>
      <div>
        {queue.map((p) => <Row key={p.id} post={p} />)}
        {queue.length === 0 && (
          <div className="muted" style={{ padding: '15px 4px' }}>Brak postów w kolejce.</div>
        )}
      </div>

      {published.length > 0 && (
        <>
          <div className="list-head" style={{ marginTop: 38 }}>
            <h3>Opublikowane</h3>
            <span className="cnt">{published.length}</span>
          </div>
          <div>
            {published.map((p) => <Row key={p.id} post={p} dim />)}
          </div>
        </>
      )}
    </>
  )
}
