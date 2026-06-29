import type { PostStatus, Platform, PostFormat, Frequency } from './types'

export const STATUSES: Record<PostStatus, { color: string; attn?: boolean }> = {
  'Zaplanowany':   { color: '#5d6970' },
  'Do akceptacji': { color: '#eb5d1c', attn: true },
  'Zaakceptowany': { color: '#209b84' },
  'Opublikowany':  { color: '#c1c8cd' },
}

// Stan pochodny: Zaplanowany + komentarz => "Do poprawek"
export const DO_POPRAWEK = { label: 'Do poprawek', color: '#eb5d1c' }

export const STATUS_ORDER: PostStatus[] = [
  'Zaplanowany', 'Do akceptacji', 'Zaakceptowany', 'Opublikowany',
]

export const PLAT_LABEL: Record<Platform, string> = {
  IG: 'Instagram', FB: 'Facebook', LI: 'LinkedIn',
}
export const PLAT_FROM_LABEL: Record<string, Platform> = {
  Instagram: 'IG', Facebook: 'FB', LinkedIn: 'LI',
}
export const ALL_PLATFORMS: Platform[] = ['IG', 'FB', 'LI']

export const FORMATS: PostFormat[] = ['Post', 'Rolka', 'Karuzela', 'Story']

export const FREQ_LABEL: Record<Frequency, string> = {
  weekly: 'co tydzień',
  biweekly: 'co 2 tygodnie',
  monthly: 'co miesiąc',
  days: 'co X dni',
}
export const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'biweekly', label: 'Co 2 tygodnie' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'days', label: 'Co X dni' },
]

export const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

export const WEEKDAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

// Paleta kolorow klienta (z ksiegi znaku)
export const PALETTE = [
  '#eb5d1c', '#209b84', '#f6b090', '#5d6970', '#f9e064', '#c1573a', '#3a7d8c', '#9a6fb0',
]

// Horyzont planowania: biezacy miesiac + 3 do przodu, 12 miesiecy historii
export const HORIZON_AHEAD_MONTHS = 3
export const HORIZON_BACK_MONTHS = 12
