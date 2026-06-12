import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import type { Client, Post, PostStatus, NewPostInput } from '../lib/types'

const POST_SELECT =
  '*, post_comments(id, post_id, author_id, body, created_at, author:profiles(display_name))'

interface PlannerState {
  clients: Client[]
  posts: Post[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createPost: (input: NewPostInput) => Promise<string | null>
  updatePostFields: (id: string, partial: Partial<Post>) => Promise<string | null>
  changeStatus: (id: string, status: PostStatus) => Promise<string | null>
  rejectPost: (id: string, comment: string) => Promise<string | null>
  createClient: (c: Omit<Client, 'id' | 'archived' | 'position'>) => Promise<string | null>
  updateClient: (id: string, partial: Partial<Client>) => Promise<string | null>
  deleteClient: (id: string) => Promise<string | null>
}

const Ctx = createContext<PlannerState | undefined>(undefined)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [cRes, pRes] = await Promise.all([
      supabase.from('clients').select('*').eq('archived', false).order('position').order('name'),
      supabase.from('posts').select(POST_SELECT).order('publish_date'),
    ])
    if (cRes.error) setError(cRes.error.message)
    else setClients((cRes.data as Client[]) ?? [])
    if (pRes.error) setError(pRes.error.message)
    else setPosts((pRes.data as Post[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) refresh()
    else {
      setClients([])
      setPosts([])
      setLoading(false)
    }
  }, [session, refresh])

  const createPost = useCallback(
    async (input: NewPostInput) => {
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
      await refresh()
      return null
    },
    [profile, refresh],
  )

  const updatePostFields = useCallback(
    async (id: string, partial: Partial<Post>) => {
      const { error } = await supabase.from('posts').update(partial).eq('id', id)
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  const changeStatus = useCallback(
    async (id: string, status: PostStatus) => {
      const { error } = await supabase.from('posts').update({ status }).eq('id', id)
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  const rejectPost = useCallback(
    async (id: string, comment: string) => {
      const { error } = await supabase.rpc('reject_post', { p_post_id: id, p_comment: comment })
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  const createClient = useCallback(
    async (c: Omit<Client, 'id' | 'archived' | 'position'>) => {
      const { error } = await supabase
        .from('clients')
        .insert({ ...c, position: clients.length })
      if (error) return error.message
      await refresh()
      return null
    },
    [clients.length, refresh],
  )

  const updateClient = useCallback(
    async (id: string, partial: Partial<Client>) => {
      const { error } = await supabase.from('clients').update(partial).eq('id', id)
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  const deleteClient = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  return (
    <Ctx.Provider
      value={{
        clients,
        posts,
        loading,
        error,
        refresh,
        createPost,
        updatePostFields,
        changeStatus,
        rejectPost,
        createClient,
        updateClient,
        deleteClient,
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
