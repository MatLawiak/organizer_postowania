import type { ReactNode } from 'react'
import type { Post, Series } from './types'
import { STATUSES, DO_POPRAWEK } from './constants'

export function Dia({ color, size }: { color: string; size?: number }) {
  return (
    <span className="dia" style={{ background: color, ...(size ? { width: size, height: size } : {}) }} />
  )
}

// ===== DATY =====
const z = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function todayMidnight(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const todayYmd = () => iso(new Date())
export const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()
export const weekdayMon = (ymd: string) => (parseISO(ymd).getDay() + 6) % 7

export function daysFromToday(ymd: string): number {
  return Math.round((parseISO(ymd).getTime() - todayMidnight().getTime()) / 86400000)
}
export const fmtDateShort = (d: string) => { const [, m, day] = d.split('-'); return `${day}.${m}` }
export const fmtDateFull = (d: string) => { const [y, m, day] = d.split('-'); return `${day}.${m}.${y}` }
export function fmtWhen(isoStr: string): string {
  const dt = new Date(isoStr)
  return `${z(dt.getDate())}.${z(dt.getMonth() + 1)}, ${z(dt.getHours())}:${z(dt.getMinutes())}`
}

// ===== STATUS / PILNOSC =====
export function needsFix(p: Post): boolean {
  return p.status === 'Zaplanowany' && (p.post_comments?.length ?? 0) > 0
}
export function displayStatus(p: Post): { label: string; color: string; attn: boolean } {
  if (needsFix(p)) return { label: DO_POPRAWEK.label, color: DO_POPRAWEK.color, attn: true }
  const s = STATUSES[p.status]
  return { label: p.status, color: s.color, attn: !!s.attn }
}

export type Urgency = { label: string; cls: 'today' | 'soon' | 'soon2' | 'overdue' } | null
export function urgency(p: Post): Urgency {
  if (p.status === 'Opublikowany') return null
  const k = daysFromToday(p.publish_date)
  if (k < 0) return { label: 'Po terminie', cls: 'overdue' }
  if (k === 0) return { label: 'Dziś', cls: 'today' }
  if (k === 1) return { label: 'Jutro', cls: 'soon' }
  if (k <= 3) return { label: `Za ${k} dni`, cls: 'soon2' }
  return null
}
export const isUrgent = (p: Post) => urgency(p) !== null

// ===== SERIE: generowanie wystapien =====
export function seriesOccurrences(s: Series, fromD: Date, toD: Date): string[] {
  const res: string[] = []
  const skip = new Set(s.skip_dates ?? [])
  const start = parseISO(s.start_date)
  const end = s.end_date ? parseISO(s.end_date) : null
  const lim = end && end < toD ? end : toD
  const push = (d: Date) => { const v = iso(d); if (!skip.has(v)) res.push(v) }
  if (s.frequency === 'monthly') {
    const dom = start.getDate()
    let cur = new Date(fromD.getFullYear(), fromD.getMonth(), dom)
    while (cur <= lim) {
      if (cur >= start && cur >= fromD) push(cur)
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, dom)
    }
    return res
  }
  const step = Math.max(1, s.interval_days)
  let d = new Date(start)
  if (d < fromD) {
    const k = Math.ceil((fromD.getTime() - d.getTime()) / 86400000 / step)
    d = addDays(d, k * step)
  }
  while (d <= lim) { push(d); d = addDays(d, step) }
  return res
}

export function freqText(s: Series): string {
  if (s.frequency === 'days') return `co ${s.interval_days} dni`
  return { weekly: 'co tydzień', biweekly: 'co 2 tygodnie', monthly: 'co miesiąc' }[s.frequency]
}

// ===== INNE =====
export function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer noopener">{part}</a>
      : <span key={i}>{part}</span>,
  )
}

export function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '')
  if (m.length !== 6) return false
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150
}
// Czy numer dnia na tle koloru ma byc ciemny (jasne kolory) — marker segmentu
export const darkSeg = (hex: string) => ['#f6b090', '#f9e064', '#c1c8cd'].includes(hex) || isLightColor(hex)
