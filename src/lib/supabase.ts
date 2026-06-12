import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error(
    'Brak konfiguracji Supabase. Uzupelnij VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY w .env.local',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
