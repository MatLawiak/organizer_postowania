import type { ReactNode } from 'react'
import type { Post } from './types'
import { STATUSES, DO_POPRAWEK } from './constants'

// Romb marki — jedyny ornament (kwadrat obrocony 45deg)
export function Dia({ color, size }: { color: string; size?: number }) {
  return (
    <span
      className="dia"
      style={{ background: color, ...(size ? { width: size, height: size } : {}) }}
    />
  )
}

// "2026-06-12" -> "12.06"
export function fmtDateShort(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}`
}

// "2026-06-12" -> "12.06.2026"
export function fmtDateFull(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

// ISO timestamp -> "12.06, 14:30"
export function fmtWhen(iso: string): string {
  const dt = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}, ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

// Zamienia URL-e w tekscie na klikalne linki
export function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

// Lokalny dzien w formacie YYYY-MM-DD (Europe/Warsaw = strefa przegladarki uzytkownika)
export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 0 = poniedzialek ... 6 = niedziela, z daty YYYY-MM-DD
export function weekdayMon(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

// Roznica dni: ymd - today (w dniach kalendarzowych)
export function daysFromToday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - t0.getTime()) / 86400000)
}

// Stan wyswietlany: "Do poprawek" gdy Zaplanowany + komentarz; inaczej realny status.
export function displayStatus(post: Post): { label: string; color: string; attn: boolean } {
  const hasComments = (post.post_comments?.length ?? 0) > 0
  if (post.status === 'Zaplanowany' && hasComments) {
    return { label: DO_POPRAWEK.label, color: DO_POPRAWEK.color, attn: true }
  }
  const s = STATUSES[post.status]
  return { label: post.status, color: s.color, attn: !!s.attn }
}

// Znacznik terminu dla kolejki "Do publikacji" (tylko nieopublikowane)
export function termInfo(
  post: Post,
): { kind: 'today' | 'tomorrow' | 'overdue'; label: string } | null {
  if (post.status === 'Opublikowany') return null
  const diff = daysFromToday(post.publish_date)
  if (diff === 0) return { kind: 'today', label: 'Dziś' }
  if (diff === 1) return { kind: 'tomorrow', label: 'Jutro' }
  if (diff < 0) return { kind: 'overdue', label: 'Po terminie' }
  return null
}
