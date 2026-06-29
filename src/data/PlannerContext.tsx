import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { seriesOccurrences, parseISO, todayMidnight } from '../lib/helpers'
import { HORIZON_AHEAD_MONTHS, HORIZON_BACK_MONTHS } from '../lib/constants'
import type {
  Client, Post, PostStatus, NewPostInput, Series, NewSeriesInput, ClientRule,
} from '../lib/types'

const POST_SELECT =
  '*, post_comments(id, post_id, author_id, body, created_at, author:profiles(display_name))'

type Res = Promise<string | null>
type ResId = Promise<{ error: string | null; id: string }>

interface PlannerState {
  clients: Client[]
  posts: Post[]          // realne rekordy
  items: Post[]          // realne + wirtualne wystapienia serii
  series: Series[]
  clientRules: ClientRule[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createPost: (i: NewPostInput) => Res
  updatePostFields: (p: Post, partial: Partial<Post>) => ResId
  changeStatus: (p: Post, s: PostStatus) => ResId
  rejectPost: (id: string, comment: string) => Res
  deletePost: (p: Post) => Res
  createClient: (c: { name: string; color: string; platforms: Client['platforms']; dark_text: boolean; note: string }) => Promise<{ error: string | null; id: string | null }>

  updateClient: (id: string, partial: Partial<Client>) => Res
  deleteClient: (id: string) => Res
  createSeries: (i: NewSeriesInput) => Res
  updateSeries: (id: string, partial: Partial<Series>) => Res
  deleteSeries: (id: string) => Res
  createClientRule: (clientId: string, body: string) => Res
  deleteClientRule: (id: string) => Res
}

const Ctx = createContext<PlannerState | undefined>(undefined)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [clientRules, setClientRules] = useState<ClientRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [c, p, s, r] = await Promise.all([
      supabase.from('clients').select('*').eq('archived', false).order('position').order('name'),
      supabase.from('posts').select(POST_SELECT).order('publish_date'),
      supabase.from('series').select('*').order('created_at'),
      supabase.from('client_rules').select('*').order('position').order('created_at'),
    ])
    if (c.error) setError(c.error.message); else setClients((c.data as Client[]) ?? [])
    if (p.error) setError(p.error.message); else setPosts((p.data as Post[]) ?? [])
    if (s.error) setError(s.error.message); else setSeries((s.data as Series[]) ?? [])
    if (r.error) setError(r.error.message); else setClientRules((r.data as ClientRule[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) refresh()
    else { setClients([]); setPosts([]); setSeries([]); setClientRules([]); setLoading(false) }
  }, [session, refresh])

  // items = realne posty + wirtualne wystapienia serii (niezmaterializowane)
  const items = useMemo<Post[]>(() => {
    const today = todayMidnight()
    const fromD = new Date(today.getFullYear(), today.getMonth() - HORIZON_BACK_MONTHS, 1)
    const toD = new Date(today.getFullYear(), today.getMonth() + HORIZON_AHEAD_MONTHS + 1, 0)
    const mat = new Set(posts.filter((p) => p.recur_id).map((p) => `${p.recur_id}:${p.recur_date}`))
    const virtuals: Post[] = []
    for (const s of series) {
      for (const date of seriesOccurrences(s, fromD, toD)) {
        if (mat.has(`${s.id}:${date}`)) continue
        virtuals.push({
          id: `v:${s.id}:${date}`,
          client_id: s.client_id,
          publish_date: date,
          publish_time: null,
          platforms: s.platforms,
          format: s.format,
          title: s.title,
          brief: s.brief,
          content: null, content_linkedin: null, graphic_url: null,
          status: parseISO(date) < today ? 'Opublikowany' : 'Zaplanowany',
          recur_id: s.id, recur_date: date,
          created_by: s.created_by,
          created_at: s.created_at, updated_at: s.created_at,
          post_comments: [],
          _virtual: true,
        })
      }
    }
    return [...posts, ...virtuals]
  }, [posts, series])

  // materializacja wirtualnego wystapienia -> realny rekord posts
  const materialize = useCallback(async (p: Post, ov: Partial<Post>): Promise<{ error: string | null; id: string }> => {
    const s = series.find((x) => x.id === p.recur_id)
    const { data, error } = await supabase.from('posts').insert({
      client_id: p.client_id,
      publish_date: p.recur_date ?? p.publish_date,
      platforms: p.platforms,
      format: p.format,
      title: p.title,
      brief: s?.brief ?? p.brief ?? null,
      content: ov.content ?? null,
      content_linkedin: ov.content_linkedin ?? null,
      graphic_url: ov.graphic_url ?? null,
      status: ov.status ?? p.status,
      recur_id: p.recur_id,
      recur_date: p.recur_date,
      created_by: profile?.id ?? null,
    }).select('id').single()
    if (error) return { error: error.message, id: p.id }
    return { error: null, id: (data as { id: string }).id }
  }, [series, profile])

  const createPost = useCallback(async (i: NewPostInput) => {
    const { error } = await supabase.from('posts').insert({
      client_id: i.client_id, publish_date: i.publish_date, platforms: i.platforms,
      format: i.format, title: i.title, brief: i.brief || null,
      graphic_url: i.graphic_url || null, status: 'Zaplanowany', created_by: profile?.id ?? null,
    })
    if (error) return error.message
    await refresh(); return null
  }, [profile, refresh])

  const updatePostFields = useCallback(async (p: Post, partial: Partial<Post>) => {
    if (p._virtual) {
      const r = await materialize(p, partial)
      if (r.error) return r
      await refresh(); return r
    }
    const { error } = await supabase.from('posts').update(partial).eq('id', p.id)
    if (error) return { error: error.message, id: p.id }
    await refresh(); return { error: null, id: p.id }
  }, [materialize, refresh])

  const changeStatus = useCallback(async (p: Post, status: PostStatus) => {
    if (p._virtual) {
      const r = await materialize(p, { status })
      if (r.error) return r
      await refresh(); return r
    }
    const { error } = await supabase.from('posts').update({ status }).eq('id', p.id)
    if (error) return { error: error.message, id: p.id }
    await refresh(); return { error: null, id: p.id }
  }, [materialize, refresh])

  const rejectPost = useCallback(async (id: string, comment: string) => {
    const { error } = await supabase.rpc('reject_post', { p_post_id: id, p_comment: comment })
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const deleteOccurrence = useCallback(async (p: Post) => {
    const s = series.find((x) => x.id === p.recur_id)
    if (s && p.recur_date) {
      const skips = Array.from(new Set([...(s.skip_dates ?? []), p.recur_date]))
      const { error } = await supabase.from('series').update({ skip_dates: skips }).eq('id', s.id)
      if (error) return error.message
    }
    if (!p._virtual) {
      const { error } = await supabase.from('posts').delete().eq('id', p.id)
      if (error) return error.message
    }
    await refresh(); return null
  }, [series, refresh])

  const deletePost = useCallback(async (p: Post) => {
    if (p.recur_id) return deleteOccurrence(p)
    const { error } = await supabase.from('posts').delete().eq('id', p.id)
    if (error) return error.message
    await refresh(); return null
  }, [deleteOccurrence, refresh])

  const createClient = useCallback(async (c: { name: string; color: string; platforms: Client['platforms']; dark_text: boolean; note: string }) => {
    const { data, error } = await supabase.from('clients').insert({
      ...c, note: c.note || null, position: clients.length, created_by: profile?.id ?? null,
    }).select('id').single()
    if (error) return { error: error.message, id: null }
    await refresh(); return { error: null, id: (data as { id: string }).id }
  }, [clients.length, profile, refresh])

  const updateClient = useCallback(async (id: string, partial: Partial<Client>) => {
    const { error } = await supabase.from('clients').update(partial).eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const createSeries = useCallback(async (i: NewSeriesInput) => {
    const { error } = await supabase.from('series').insert({
      client_id: i.client_id, title: i.title, format: i.format, platforms: i.platforms,
      brief: i.brief || null, frequency: i.frequency, interval_days: i.interval_days,
      start_date: i.start_date, end_date: i.end_date, created_by: profile?.id ?? null,
    })
    if (error) return error.message
    await refresh(); return null
  }, [profile, refresh])

  const updateSeries = useCallback(async (id: string, partial: Partial<Series>) => {
    const { error } = await supabase.from('series').update(partial).eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const deleteSeries = useCallback(async (id: string) => {
    // opublikowane materializowane wystapienia zostawiamy w historii (odpinamy od serii)
    await supabase.from('posts').update({ recur_id: null }).eq('recur_id', id).eq('status', 'Opublikowany')
    const { error } = await supabase.from('series').delete().eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const createClientRule = useCallback(async (clientId: string, body: string) => {
    const position = clientRules.filter((r) => r.client_id === clientId).length
    const { error } = await supabase.from('client_rules').insert({
      client_id: clientId, body, position, created_by: profile?.id ?? null,
    })
    if (error) return error.message
    await refresh(); return null
  }, [clientRules, profile, refresh])

  const deleteClientRule = useCallback(async (id: string) => {
    const { error } = await supabase.from('client_rules').delete().eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  return (
    <Ctx.Provider value={{
      clients, posts, items, series, clientRules, loading, error, refresh,
      createPost, updatePostFields, changeStatus, rejectPost, deletePost,
      createClient, updateClient, deleteClient,
      createSeries, updateSeries, deleteSeries,
      createClientRule, deleteClientRule,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePlanner() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlanner musi byc uzyty wewnatrz PlannerProvider')
  return ctx
}
