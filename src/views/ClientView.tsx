import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort } from '../lib/helpers'
import { STATUSES, STATUS_ORDER, PLAT_LABEL } from '../lib/constants'
import type { Client, PostStatus } from '../lib/types'

interface Props {
  client: Client
  onOpenPost: (id: string) => void
  onNewPost: () => void
}

type Filter = 'Wszystkie' | PostStatus

export function ClientView({ client, onOpenPost, onNewPost }: Props) {
  const { posts } = usePlanner()
  const { isAdmin } = useAuth()
  const [filter, setFilter] = useState<Filter>('Wszystkie')

  const clientPosts = useMemo(
    () => posts.filter((p) => p.client_id === client.id),
    [posts, client.id],
  )

  const cnt = (s: PostStatus) => clientPosts.filter((p) => p.status === s).length

  const shown = useMemo(
    () =>
      clientPosts
        .filter((p) => filter === 'Wszystkie' || p.status === filter)
        .sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)),
    [clientPosts, filter],
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{client.name}</h1>
          <div className="tagline">
            {client.platforms.map((p) => (
              <span key={p}>/{PLAT_LABEL[p].toLowerCase()}</span>
            ))}
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={onNewPost}>
            + Zaplanuj post
          </button>
        )}
      </div>

      <div className="statline">
        <span>
          <b>{clientPosts.length}</b> łącznie
        </span>
        <span className="warn">
          <b>{cnt('Do akceptacji')}</b> do akceptu
        </span>
        <span className="warn">
          <b>{cnt('Do poprawy')}</b> do poprawy
        </span>
        <span>
          <b>{cnt('Zaakceptowany')}</b> do publikacji
        </span>
        <span>
          <b>{cnt('Opublikowany')}</b> opublikowane
        </span>
      </div>

      <div className="filters">
        {(['Wszystkie', ...STATUS_ORDER] as Filter[]).map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div>
        <div className="trow head">
          <div>Data</div>
          <div>Post</div>
          <div className="hide-m">Platformy</div>
          <div className="hide-m">Format</div>
          <div>Status</div>
          <div />
        </div>
        {shown.length === 0 && (
          <div className="trow" style={{ cursor: 'default', color: 'var(--gray)' }}>
            Brak postów dla tego filtra.
          </div>
        )}
        {shown.map((p) => {
          const s = STATUSES[p.status]
          return (
            <div key={p.id} className="trow" onClick={() => onOpenPost(p.id)}>
              <div className="t-date">{fmtDateShort(p.publish_date)}</div>
              <div className="t-title">{p.title}</div>
              <div className="plats hide-m">
                {p.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}
              </div>
              <div className="fmt hide-m">{p.format}</div>
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
      </div>
    </>
  )
}
