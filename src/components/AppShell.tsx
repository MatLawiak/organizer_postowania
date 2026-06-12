import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia } from '../lib/helpers'
import { CalendarView } from '../views/CalendarView'
import { ClientView } from '../views/ClientView'
import { PostModal } from './PostModal'
import { NewPostForm } from './NewPostForm'
import { ClientForm } from './ClientForm'
import { Tooltip, type TipState } from './Tooltip'

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth()
  const { clients, posts, loading, error } = usePlanner()

  // 'cal' = kalendarz, w przeciwnym razie id klienta
  const [activeTab, setActiveTab] = useState<string>('cal')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  // formularz nowego posta: { client } gdzie client to preselekcja ('' = wybór w formularzu) lub null = zamkniety
  const [newPostFor, setNewPostFor] = useState<string | null | undefined>(undefined)
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [tip, setTip] = useState<TipState | null>(null)

  // Jesli aktywna zakladka klienta zniknela (np. usuniety) — wroc do kalendarza
  useEffect(() => {
    if (activeTab !== 'cal' && !clients.some((c) => c.id === activeTab)) {
      setActiveTab('cal')
    }
  }, [clients, activeTab])

  const go = (tab: string) => {
    setActiveTab(tab)
    window.scrollTo(0, 0)
  }

  // Otwarcie posta z kalendarza — przejscie do zakladki klienta + modal
  const goPost = (postId: string) => {
    const p = posts.find((x) => x.id === postId)
    if (p) setActiveTab(p.client_id)
    setOpenPostId(postId)
    setTip(null)
  }

  const waitingCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of posts) {
      const key = isAdmin ? 'Do akceptacji' : 'Do poprawy'
      if (p.status === key) map[p.client_id] = (map[p.client_id] ?? 0) + 1
    }
    return map
  }, [posts, isAdmin])

  const activeClient = clients.find((c) => c.id === activeTab) ?? null
  const openPost = openPostId ? posts.find((p) => p.id === openPostId) ?? null : null

  return (
    <>
      <div className="topbar">
        <img src="/logo-twistedpixel.png" alt="Twisted Pixel" />
        <div className="app-name">Planner postów</div>
        <div className="user-box">
          <span className="who">
            <Dia color={isAdmin ? 'var(--accent)' : 'var(--mint)'} />
            {profile?.display_name}
            <span className="role">{isAdmin ? 'Admin' : 'Pracownik'}</span>
          </span>
          <button className="linkbtn" onClick={() => signOut()}>
            Wyloguj
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'cal' ? 'active' : ''}`} onClick={() => go('cal')}>
          Kalendarz
        </button>
        {clients.map((c) => {
          const w = waitingCount[c.id] ?? 0
          return (
            <button
              key={c.id}
              className={`tab ${activeTab === c.id ? 'active' : ''}`}
              onClick={() => go(c.id)}
            >
              <Dia color={c.color} />
              {c.name}
              {w > 0 && <span className="badge-count">{w}</span>}
            </button>
          )
        })}
        {isAdmin && (
          <button className="tab add" onClick={() => setClientFormOpen(true)} title="Dodaj klienta">
            +
          </button>
        )}
      </div>

      <div className="main">
        {error && <div className="err">Błąd: {error}</div>}
        {loading ? (
          <div className="muted">Ładowanie danych…</div>
        ) : activeTab === 'cal' ? (
          <CalendarView
            onOpenPost={goPost}
            onNewPost={() => setNewPostFor('')}
            onTip={setTip}
          />
        ) : activeClient ? (
          <ClientView
            client={activeClient}
            onOpenPost={(id) => setOpenPostId(id)}
            onNewPost={() => setNewPostFor(activeClient.id)}
          />
        ) : null}
      </div>

      <Tooltip tip={tip} />

      {openPost && <PostModal post={openPost} onClose={() => setOpenPostId(null)} />}

      {newPostFor !== undefined && (
        <NewPostForm presetClientId={newPostFor || ''} onClose={() => setNewPostFor(undefined)} />
      )}

      {clientFormOpen && <ClientForm onClose={() => setClientFormOpen(false)} />}
    </>
  )
}
