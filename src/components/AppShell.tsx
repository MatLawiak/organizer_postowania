import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, needsFix, daysFromToday } from '../lib/helpers'
import { QueueView } from '../views/QueueView'
import { FixView } from '../views/FixView'
import { CalendarView } from '../views/CalendarView'
import { StatsView } from '../views/StatsView'
import { ClientView } from '../views/ClientView'
import { PostModal } from './PostModal'
import { PostForm } from './PostForm'
import { ClientForm } from './ClientForm'
import { SeriesModal } from './SeriesModal'
import { Tooltip, type TipState } from './Tooltip'
import type { Post } from '../lib/types'

function needsAction(p: Post, isAdmin: boolean) {
  return isAdmin ? p.status === 'Do akceptacji' : (p.status === 'Zaakceptowany' || needsFix(p))
}

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth()
  const { clients, items, loading, error } = usePlanner()

  const [activeTab, setActiveTab] = useState<string>('queue')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [postForm, setPostForm] = useState<{ client: string } | null>(null)
  const [clientForm, setClientForm] = useState<{ editId: string | null } | null>(null)
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const fixed = ['queue', 'fix', 'cal', 'stats']
    if (!fixed.includes(activeTab) && !clients.some((c) => c.id === activeTab)) setActiveTab('queue')
  }, [clients, activeTab])

  useEffect(() => {
    const close = () => setNotifOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const go = (tab: string) => { setActiveTab(tab); window.scrollTo(0, 0) }
  const openPost = (id: string, switchToClient = false) => {
    if (switchToClient) { const p = items.find((x) => x.id === id); if (p) setActiveTab(p.client_id) }
    setOpenPostId(id); setTip(null)
  }

  const fixCount = useMemo(() => items.filter(needsFix).length, [items])
  const badge = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of items) if (needsAction(p, isAdmin)) m[p.client_id] = (m[p.client_id] ?? 0) + 1
    return m
  }, [items, isAdmin])

  const notifs = useMemo(() => {
    const out: { clientId: string; text: string }[] = []
    const cName = (id: string) => clients.find((c) => c.id === id)?.name ?? ''
    if (isAdmin) items.filter((p) => p.status === 'Do akceptacji').forEach((p) => out.push({ clientId: p.client_id, text: `${p.title} — czeka na akcept (${cName(p.client_id)})` }))
    else {
      items.filter(needsFix).forEach((p) => out.push({ clientId: p.client_id, text: `${p.title} — do poprawek` }))
      items.filter((p) => p.status === 'Zaakceptowany').forEach((p) => out.push({ clientId: p.client_id, text: `${p.title} — gotowe do publikacji` }))
    }
    items.filter((p) => p.status !== 'Opublikowany' && [0, 1].includes(daysFromToday(p.publish_date)))
      .forEach((p) => out.push({ clientId: p.client_id, text: `${p.title} — termin ${daysFromToday(p.publish_date) === 0 ? 'dziś' : 'jutro'}` }))
    return out
  }, [items, clients, isAdmin])

  const activeClient = clients.find((c) => c.id === activeTab) ?? null
  const openPostObj = openPostId ? items.find((p) => p.id === openPostId) ?? null : null

  return (
    <>
      <div className="topbar">
        <img src="/logo-twistedpixel.png" alt="Twisted Pixel" />
        <div className="app-name">Planner postów</div>
        <div className="notif" onClick={(e) => { e.stopPropagation(); setNotifOpen((v) => !v) }} title="Powiadomienia">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {notifs.length > 0 && <span className="ncount">{notifs.length}</span>}
          <div className={`notif-panel${notifOpen ? ' show' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h6>Powiadomienia{notifs.length ? ` (${notifs.length})` : ''}</h6>
            {notifs.length === 0 && <div className="notif-item" style={{ color: 'var(--ink-3)' }}>Brak powiadomień.</div>}
            {notifs.slice(0, 14).map((n, i) => (
              <div className="notif-item" key={i}>
                <Dia color={clients.find((c) => c.id === n.clientId)?.color ?? 'var(--accent)'} size={7} />
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </div>
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
        <button className={`tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => go('queue')}>Zaplanowane</button>
        <button className={`tab ${activeTab === 'fix' ? 'active' : ''}`} onClick={() => go('fix')}>
          Do poprawy{fixCount > 0 && <span className="badge-count">{fixCount}</span>}
        </button>
        <button className={`tab ${activeTab === 'cal' ? 'active' : ''}`} onClick={() => go('cal')}>Kalendarz</button>
        <button className={`tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => go('stats')}>Statystyki</button>
        {clients.map((c) => (
          <button key={c.id} className={`tab ${activeTab === c.id ? 'active' : ''}`} onClick={() => go(c.id)}>
            <Dia color={c.color} />{c.name}
            {(badge[c.id] ?? 0) > 0 && <span className="badge-count">{badge[c.id]}</span>}
          </button>
        ))}
        <button className="tab add" onClick={() => setClientForm({ editId: null })}>+ Klient</button>
      </div>

      <div className="main">
        {error && <div className="err">Błąd: {error}</div>}
        {loading ? <div className="muted">Ładowanie danych…</div>
          : activeTab === 'queue' ? <QueueView onOpenPost={(id) => openPost(id)} onNewPost={() => setPostForm({ client: '' })} />
          : activeTab === 'fix' ? <FixView onOpenPost={(id) => openPost(id)} />
          : activeTab === 'cal' ? <CalendarView onOpenPost={(id) => openPost(id, true)} onNewPost={() => setPostForm({ client: '' })} onOpenSeries={setSeriesId} onTip={setTip} />
          : activeTab === 'stats' ? <StatsView />
          : activeClient ? <ClientView client={activeClient} onOpenPost={(id) => openPost(id)} onNewPost={() => setPostForm({ client: activeClient.id })} onEditClient={() => setClientForm({ editId: activeClient.id })} onOpenSeries={setSeriesId} onDeleted={() => go('queue')} />
          : null}
      </div>

      <Tooltip tip={tip} />

      {openPostObj && <PostModal post={openPostObj} onClose={() => setOpenPostId(null)} onReplaceId={setOpenPostId} />}
      {postForm && <PostForm presetClientId={postForm.client} onClose={() => setPostForm(null)} onGoCalendar={() => { setPostForm(null); go('cal') }} />}
      {clientForm && <ClientForm editId={clientForm.editId} onClose={() => setClientForm(null)} onCreated={(id) => { setClientForm(null); go(id) }} />}
      {seriesId && <SeriesModal seriesId={seriesId} onClose={() => setSeriesId(null)} />}
    </>
  )
}
