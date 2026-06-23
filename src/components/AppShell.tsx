import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia } from '../lib/helpers'
import { QueueView } from '../views/QueueView'
import { CalendarView } from '../views/CalendarView'
import { ClientView } from '../views/ClientView'
import { PostModal } from './PostModal'
import { NewPostForm } from './NewPostForm'
import { ClientForm } from './ClientForm'
import { Tooltip, type TipState } from './Tooltip'

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth()
  const { clients, posts, loading, error } = usePlanner()

  // 'queue' = Do publikacji (domyslny), 'cal' = Kalendarz, inaczej id klienta
  const [activeTab, setActiveTab] = useState<string>('queue')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [newPostFor, setNewPostFor] = useState<string | null | undefined>(undefined)
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [tip, setTip] = useState<TipState | null>(null)

  useEffect(() => {
    if (activeTab !== 'queue' && activeTab !== 'cal' && !clients.some((c) => c.id === activeTab)) {
      setActiveTab('queue')
    }
  }, [clients, activeTab])

  const go = (tab: string) => {
    setActiveTab(tab)
    window.scrollTo(0, 0)
  }

  // Otwarcie posta — opcjonalnie przejscie do zakladki klienta (z kalendarza)
  const openPost = (postId: string, switchToClient = false) => {
    if (switchToClient) {
      const p = posts.find((x) => x.id === postId)
      if (p) setActiveTab(p.client_id)
    }
    setOpenPostId(postId)
    setTip(null)
  }

  // Licznik "do zrobienia" dla roli: admin = Do akceptacji; worker = Do poprawek + Zaakceptowany
  const badge = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of posts) {
      const isDoPoprawek = p.status === 'Zaplanowany' && (p.post_comments?.length ?? 0) > 0
      const hit = isAdmin
        ? p.status === 'Do akceptacji'
        : isDoPoprawek || p.status === 'Zaakceptowany'
      if (hit) map[p.client_id] = (map[p.client_id] ?? 0) + 1
    }
    return map
  }, [posts, isAdmin])

  const activeClient = clients.find((c) => c.id === activeTab) ?? null
  const openPostObj = openPostId ? posts.find((p) => p.id === openPostId) ?? null : null

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
          <button className="linkbtn" onClick={() => signOut()}>Wyloguj</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => go('queue')}>
          Do publikacji
        </button>
        <button className={`tab ${activeTab === 'cal' ? 'active' : ''}`} onClick={() => go('cal')}>
          Kalendarz
        </button>
        {clients.map((c) => {
          const w = badge[c.id] ?? 0
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
          <button className="tab add" onClick={() => setClientFormOpen(true)} title="Dodaj klienta">+</button>
        )}
      </div>

      <div className="main">
        {error && <div className="err">Błąd: {error}</div>}
        {loading ? (
          <div className="muted">Ładowanie danych…</div>
        ) : activeTab === 'queue' ? (
          <QueueView onOpenPost={(id) => openPost(id)} />
        ) : activeTab === 'cal' ? (
          <CalendarView
            onOpenPost={(id) => openPost(id, true)}
            onNewPost={() => setNewPostFor('')}
            onTip={setTip}
          />
        ) : activeClient ? (
          <ClientView
            client={activeClient}
            onOpenPost={(id) => openPost(id)}
            onNewPost={() => setNewPostFor(activeClient.id)}
            onDeleted={() => go('queue')}
          />
        ) : null}
      </div>

      <Tooltip tip={tip} />

      {openPostObj && <PostModal post={openPostObj} onClose={() => setOpenPostId(null)} />}

      {newPostFor !== undefined && (
        <NewPostForm presetClientId={newPostFor || ''} onClose={() => setNewPostFor(undefined)} />
      )}

      {clientFormOpen && <ClientForm onClose={() => setClientFormOpen(false)} />}
    </>
  )
}
