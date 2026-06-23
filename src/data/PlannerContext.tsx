import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import type {
  Client, Post, PostStatus, NewPostInput, RecurringTask, ClientRule,
} from '../lib/types'

const POST_SELECT =
  '*, post_comments(id, post_id, author_id, body, created_at, author:profiles(display_name))'

interface PlannerState {
  clients: Client[]
  posts: Post[]
  recurringTasks: RecurringTask[]
  clientRules: ClientRule[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  // posty
  createPost: (input: NewPostInput) => Promise<string | null>
  updatePostFields: (id: string, partial: Partial<Post>) => Promise<string | null>
  changeStatus: (id: string, status: PostStatus) => Promise<string | null>
  rejectPost: (id: string, comment: string) => Promise<string | null>
  deletePost: (id: string) => Promise<string | null>
  // klienci
  createClient: (c: Omit<Client, 'id' | 'archived' | 'position'>) => Promise<string | null>
  updateClient: (id: string, partial: Partial<Client>) => Promise<string | null>
  deleteClient: (id: string) => Promise<string | null>
  // zadania cykliczne
  createRecurringTask: (
    t: Omit<RecurringTask, 'id' | 'created_by' | 'created_at' | 'frequency'>,
  ) => Promise<string | null>
  deleteRecurringTask: (id: string) => Promise<string | null>
  // zasady prowadzenia
  createClientRule: (clientId: string, body: string) => Promise<string | null>
  deleteClientRule: (id: string) => Promise<string | null>
}

const Ctx = createContext<PlannerState | undefined>(undefined)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [clientRules, setClientRules] = useState<ClientRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [cRes, pRes, rtRes, crRes] = await Promise.all([
      supabase.from('clients').select('*').eq('archived', false).order('position').order('name'),
      supabase.from('posts').select(POST_SELECT).order('publish_date'),
      supabase.from('recurring_tasks').select('*').order('weekday'),
      supabase.from('client_rules').select('*').order('position').order('created_at'),
    ])
    if (cRes.error) setError(cRes.error.message); else setClients((cRes.data as Client[]) ?? [])
    if (pRes.error) setError(pRes.error.message); else setPosts((pRes.data as Post[]) ?? [])
    if (rtRes.error) setError(rtRes.error.message); else setRecurringTasks((rtRes.data as RecurringTask[]) ?? [])
    if (crRes.error) setError(crRes.error.message); else setClientRules((crRes.data as ClientRule[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) refresh()
    else {
      setClients([]); setPosts([]); setRecurringTasks([]); setClientRules([])
      setLoading(false)
    }
  }, [session, refresh])

  // ---- posty ----
  const createPost = useCallback(async (input: NewPostInput) => {
    const { error } = await supabase.from('posts').insert({
      client_id: input.client_id,
      publish_date: input.publish_date,
      platforms: input.platforms,
      format: input.format,
      title: input.title,
      brief: input.brief || null,
      graphic_url: input.graphic_url || null,
      status: 'Zaplanowany',
      created_by: profile?.id ?? null,
    })
    if (error) return error.message
    await refresh(); return null
  }, [profile, refresh])

  const updatePostFields = useCallback(async (id: string, partial: Partial<Post>) => {
    const { error } = await supabase.from('posts').update(partial).eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const changeStatus = useCallback(async (id: string, status: PostStatus) => {
    const { error } = await supabase.from('posts').update({ status }).eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const rejectPost = useCallback(async (id: string, comment: string) => {
    const { error } = await supabase.rpc('reject_post', { p_post_id: id, p_comment: comment })
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  // ---- klienci ----
  const createClient = useCallback(async (c: Omit<Client, 'id' | 'archived' | 'position'>) => {
    const { error } = await supabase.from('clients').insert({ ...c, position: clients.length })
    if (error) return error.message
    await refresh(); return null
  }, [clients.length, refresh])

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

  // ---- zadania cykliczne ----
  const createRecurringTask = useCallback(
    async (t: Omit<RecurringTask, 'id' | 'created_by' | 'created_at' | 'frequency'>) => {
      const { error } = await supabase.from('recurring_tasks').insert({
        client_id: t.client_id,
        label: t.label,
        description: t.description || null,
        weekday: t.weekday,
        frequency: 'weekly',
        created_by: profile?.id ?? null,
      })
      if (error) return error.message
      await refresh(); return null
    },
    [profile, refresh],
  )

  const deleteRecurringTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('recurring_tasks').delete().eq('id', id)
    if (error) return error.message
    await refresh(); return null
  }, [refresh])

  // ---- zasady prowadzenia ----
  const createClientRule = useCallback(async (clientId: string, body: string) => {
    const position = clientRules.filter((r) => r.client_id === clientId).length
    const { error } = await supabase.from('client_rules').insert({
      client_id: clientId,
      body,
      position,
      created_by: profile?.id ?? null,
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
    <Ctx.Provider
      value={{
        clients, posts, recurringTasks, clientRules, loading, error, refresh,
        createPost, updatePostFields, changeStatus, rejectPost, deletePost,
        createClient, updateClient, deleteClient,
        createRecurringTask, deleteRecurringTask,
        createClientRule, deleteClientRule,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function usePlanner() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlanner musi byc uzyty wewnatrz PlannerProvider')
  return ctx
}
