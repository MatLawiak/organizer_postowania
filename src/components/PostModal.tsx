import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateFull, fmtWhen, linkify, displayStatus } from '../lib/helpers'
import { PLAT_LABEL } from '../lib/constants'
import { UTag } from './UTag'
import { ConfirmDialog } from './ConfirmDialog'
import type { Post, PostStatus } from '../lib/types'

export function PostModal({ post, onClose, onReplaceId }: { post: Post; onClose: () => void; onReplaceId: (id: string) => void }) {
  const { isAdmin, profile } = useAuth()
  const { clients, series, changeStatus, updatePostFields, rejectPost, deletePost } = usePlanner()
  const client = clients.find((c) => c.id === post.client_id)

  const [brief, setBrief] = useState(post.brief ?? '')
  const [content, setContent] = useState(post.content ?? '')
  const [contentLi, setContentLi] = useState(post.content_linkedin ?? '')
  const [graphic, setGraphic] = useState(post.graphic_url ?? '')
  const [showFix, setShowFix] = useState(false)
  const [fixText, setFixText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    setBrief(post.brief ?? ''); setContent(post.content ?? '')
    setContentLi(post.content_linkedin ?? ''); setGraphic(post.graphic_url ?? '')
    setShowFix(false); setFixText(''); setErr(null); setSaved(false)
  }, [post.id, post.brief, post.content, post.content_linkedin, post.graphic_url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!client) return null
  const ds = displayStatus(post)
  const rec = !!post.recur_id
  const hasLi = post.platforms.includes('LI') && post.platforms.length > 1

  function canDelete(): boolean {
    if (isAdmin) return true
    if (rec) { const s = series.find((x) => x.id === post.recur_id); return !!s && s.created_by === profile?.id }
    return post.created_by === profile?.id && post.status !== 'Zaakceptowany' && post.status !== 'Opublikowany'
  }

  const dirty =
    (!rec && brief !== (post.brief ?? '')) ||
    content !== (post.content ?? '') ||
    contentLi !== (post.content_linkedin ?? '') ||
    graphic !== (post.graphic_url ?? '')

  async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true); setErr(null)
    const r = await fn(); setBusy(false); return r
  }

  async function save() {
    const partial = rec
      ? { content: content || null, content_linkedin: contentLi || null, graphic_url: graphic || null }
      : { brief: brief || null, content: content || null, content_linkedin: contentLi || null, graphic_url: graphic || null }
    const r = await withBusy(() => updatePostFields(post, partial))
    if (r.error) setErr(r.error)
    else { if (r.id !== post.id) onReplaceId(r.id); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function transition(status: PostStatus) {
    const r = await withBusy(() => changeStatus(post, status))
    if (r.error) setErr(r.error)
    else if (r.id !== post.id) onReplaceId(r.id)
  }

  async function sendFix() {
    const t = fixText.trim(); if (!t) return
    const e = await withBusy(() => rejectPost(post.id, t))
    if (e) setErr(e); else { setShowFix(false); setFixText('') }
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>{rec && <span className="rtag">♻</span>} {post.title}</h3>
            <div className="sub">{client.name} · {fmtDateFull(post.publish_date)}{rec ? ' · cykliczny — bez akceptacji' : ''}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        <div className="modal-body">
          <div className="sec">
            <div className="meta-chips">
              <span>{post.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}</span><span>·</span>
              <span>{post.format}</span><span>·</span>
              <span className={`status${ds.attn ? ' attn' : ''}`}><Dia color={ds.color} size={7} />{ds.label}</span>
              <UTag post={post} />
            </div>
          </div>

          <div className="sec">
            <div className="sec-label">Brief / wytyczne{rec ? ' (z serii)' : ''}</div>
            {rec
              ? <div className="plain">{post.brief ? linkify(post.brief) : <span className="muted">—</span>}</div>
              : <textarea className="field" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Wytyczne, materiały, CTA…" />}
          </div>

          <div className="sec">
            <div className="sec-label">Treść posta{hasLi ? ' — Meta (IG / FB)' : ''}{rec ? ' — opcjonalna dla cyklicznych' : ''}</div>
            <textarea className="field" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Gotowa treść posta…" />
          </div>

          {hasLi && (
            <div className="sec">
              <div className="sec-label">Wariant LinkedIn <span className="opt-hint">— opcjonalny</span></div>
              <textarea className="field" rows={3} value={contentLi} onChange={(e) => setContentLi(e.target.value)} placeholder="Wypełnij, jeśli wersja LinkedIn ma się różnić" />
            </div>
          )}

          <div className="sec">
            <div className="sec-label">Grafika / materiał</div>
            <input className="field" value={graphic} onChange={(e) => setGraphic(e.target.value)} placeholder="Link do Canvy / Drive" />
          </div>

          {(post.post_comments?.length ?? 0) > 0 && (
            <div className="sec">
              <div className="sec-label">Uwagi do poprawy</div>
              {[...(post.post_comments ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((cm) => (
                <div className="comment" key={cm.id}><b>{cm.author?.display_name ?? 'Admin'}:</b> {cm.body}<span className="when">{fmtWhen(cm.created_at)}</span></div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          {dirty && <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz zmiany'}</button>}
          {saved && !dirty && <span className="saved-hint">Zapisano ✓</span>}

          <Actions post={post} rec={rec} isAdmin={isAdmin} busy={busy} showFix={showFix}
            onShowFix={() => setShowFix(true)} onTransition={transition} />

          {canDelete() && <span className="del-link" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(true)}>{rec ? 'Usuń wystąpienie' : 'Usuń post'}</span>}

          {err && <span className="err" style={{ marginBottom: 0, marginLeft: 0, flexBasis: '100%' }}>{err}</span>}

          {showFix && (
            <div className="fix-area show">
              <input className="field" value={fixText} onChange={(e) => setFixText(e.target.value)} placeholder="Co poprawić? (wróci do „Do poprawek”)" autoFocus />
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={sendFix} disabled={busy || !fixText.trim()}>Wyślij uwagi</button>
            </div>
          )}
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog
          title={rec ? 'Usunąć wystąpienie?' : 'Usunąć post?'}
          message={rec ? `Wystąpienie „${post.title}" (${fmtDateFull(post.publish_date)}) zniknie. Sama seria zostaje.` : `Post „${post.title}" zostanie trwale usunięty.`}
          confirmLabel="Usuń"
          onConfirm={async () => { const e = await deletePost(post); if (!e) onClose(); return e }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}

function Actions({ post, rec, isAdmin, busy, showFix, onShowFix, onTransition }: {
  post: Post; rec: boolean; isAdmin: boolean; busy: boolean; showFix: boolean
  onShowFix: () => void; onTransition: (s: PostStatus) => void
}) {
  if (post.status === 'Opublikowany') return <span className="note" style={{ marginLeft: 0 }}>Opublikowany — brak akcji.</span>
  const publish = <button className="btn btn-mint" disabled={busy} onClick={() => onTransition('Opublikowany')}>Oznacz: Opublikowany</button>
  if (rec) return <><span className="rtag" style={{ marginRight: 14 }}>♻ cykliczny — bez akceptacji</span>{publish}</>
  if (isAdmin) {
    if (post.status === 'Do akceptacji') return (
      <>
        <button className="btn btn-mint" disabled={busy} onClick={() => onTransition('Zaakceptowany')}>Akceptuj</button>
        {!showFix && <button className="btn btn-line" disabled={busy} onClick={onShowFix}>Do poprawy</button>}
        {publish}
      </>
    )
    return publish
  }
  // worker
  if (post.status === 'Zaplanowany') return <><button className="btn btn-primary" disabled={busy} onClick={() => onTransition('Do akceptacji')}>Wyślij do akceptacji</button>{publish}</>
  if (post.status === 'Do akceptacji') return <><span className="note" style={{ marginLeft: 0, marginRight: 14 }}>Czeka na akcept Wojciecha.</span>{publish}</>
  return publish
}
