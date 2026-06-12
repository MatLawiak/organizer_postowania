import type { ReactNode } from 'react'

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

// Zamienia URL-e w tekscie na klikalne linki (do briefu / komentarzy)
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
