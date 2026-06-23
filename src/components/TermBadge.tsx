import type { Post } from '../lib/types'
import { termInfo } from '../lib/helpers'

export function TermBadge({ post }: { post: Post }) {
  const t = termInfo(post)
  if (!t) return null
  return <span className={`term term-${t.kind}`}>{t.label}</span>
}
