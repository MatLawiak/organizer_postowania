import type { PostStatus, Platform, PostFormat } from './types'

// Kolory rombow statusow — wg sekcji 7.3 specyfikacji v1.2 (4 statusy).
export const STATUSES: Record<PostStatus, { color: string; attn?: boolean }> = {
  'Zaplanowany':   { color: '#5d6970' },
  'Do akceptacji': { color: '#eb5d1c', attn: true },
  'Zaakceptowany': { color: '#209b84', attn: true }, // gotowe do publikacji — czeka na workera
  'Opublikowany':  { color: '#c1c8cd' },
}

// Stan pochodny: Zaplanowany + komentarz => "Do poprawek" (pomaranczowy).
export const DO_POPRAWEK = { label: 'Do poprawek', color: '#eb5d1c' }

export const STATUS_ORDER: PostStatus[] = [
  'Zaplanowany',
  'Do akceptacji',
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

// 0 = poniedzialek ... 6 = niedziela
export const WEEKDAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
export const WEEKDAYS_PL_FULL = [
  'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela',
]
// "co poniedziałek / co wtorek / co środę ..." — forma po "co"
export const WEEKDAYS_PL_CO = [
  'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę',
]

export const META_PLATFORMS: Platform[] = ['IG', 'FB']
