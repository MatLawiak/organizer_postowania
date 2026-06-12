import type { PostStatus, Platform, PostFormat } from './types'

// Kolory rombow statusow — wg sekcji 7.3 specyfikacji.
export const STATUSES: Record<PostStatus, { color: string; attn?: boolean }> = {
  'Zaplanowany':     { color: '#5d6970' },
  'W przygotowaniu': { color: '#f6b090' },
  'Do akceptacji':   { color: '#eb5d1c', attn: true },
  'Do poprawy':      { color: '#f9e064', attn: true },
  'Zaakceptowany':   { color: '#209b84' },
  'Opublikowany':    { color: '#c1c8cd' },
}

export const STATUS_ORDER: PostStatus[] = [
  'Zaplanowany',
  'W przygotowaniu',
  'Do akceptacji',
  'Do poprawy',
  'Zaakceptowany',
  'Opublikowany',
]

export const PLAT_LABEL: Record<Platform, string> = {
  IG: 'Instagram',
  FB: 'Facebook',
  LI: 'LinkedIn',
}

export const FORMATS: PostFormat[] = ['Post', 'Rolka', 'Karuzela', 'Story']

export const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

export const WEEKDAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

// Czy ciemny numer dnia jest czytelny na tle koloru klienta (jasne tla -> ciemny numer)
export const META_PLATFORMS: Platform[] = ['IG', 'FB']
