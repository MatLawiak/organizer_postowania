import type { Post, Client } from '../lib/types'
import { PLAT_LABEL } from '../lib/constants'

export interface TipState {
  post: Post
  client: Client
  x: number
  y: number
}

export function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null
  const { post, client, x, y } = tip
  return (
    <div
      className="tooltip show"
      style={{ left: Math.min(x, window.innerWidth - 310), top: y + 6 }}
    >
      <div className="t-client">{client.name}</div>
      <h5>{post.title}</h5>
      <div className="t-meta">
        {post.platforms.map((p) => PLAT_LABEL[p]).join(' · ')} · {post.format}
      </div>
      <div className="t-meta">{post.status}</div>
    </div>
  )
}
