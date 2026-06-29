import type { Post } from '../lib/types'
import { urgency } from '../lib/helpers'

// Znacznik terminu: Dziś / Jutro / Za N dni / Po terminie
export function UTag({ post }: { post: Post }) {
  const u = urgency(post)
  if (!u) return null
  return <span className={`utag ${u.cls}`}>{u.label}</span>
}
