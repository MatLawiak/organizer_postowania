import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateFull, fmtWhen, linkify } from '../lib/helpers'
import { STATUSES, PLAT_LABEL } from '../lib/constants'
import type { Post, PostStatus } from '../lib/types'

export function PostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const { clients, changeStatus, updatePostFields, rejectPost } = usePlanner()
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

  // Reset stanu przy zmianie posta
  useEffect(() => {
    setBrief(post.brief ?? '')
    setContent(post.content ?? '')
    setContentLi(post.content_linkedin ?? '')
    setGraphic(post.graphic_url ?? '')
    setShowFix(false)
    setFixText('')
    setErr(null)
    setSaved(false)
  }, [post.id, post.brief, post.content, post.content_linkedin, post.graphic_url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!client) return null
  const s = STATUSES[post.status]
  const hasLi = post.platforms.includes('LI') && post.platforms.length > 1

  // Co jest brudne (zalezne od roli)
  const dirty = isAdmin
    ? brief !== (post.brief ?? '')
    : content !== (post.content ?? '') ||
      contentLi !== (post.content_linkedin ?? '') ||
      graphic !== (post.graphic_url ?? '')

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    setErr(null)
    const e = await fn()
    setBusy(false)
    if (e) setErr(e)
    return e
  }

  async function save() {
    const partial = isAdmin
      ? { brief: brief || null }
      : { content: content || null, content_linkedin: contentLi || null, graphic_url: graphic || null }
    const e = await run(() => updatePostFields(post.id, partial))
    if (!e) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  async function transition(status: PostStatus) {
    await run(() => changeStatus(post.id, status))
  }

  async function sendFix() {
    const t = fixText.trim()
    if (!t) return
    const e = await run(() => rejectPost(post.id, t))
    if (!e) {
      setShowFix(false)
      setFixText('')
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>{post.title}</h3>
            <div className="sub">
              {client.name} · {fmtDateFull(post.publish_date)}
            </div>
          </div>
          <button className="x" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="sec">
            <div className="meta-chips">
              <span>{post.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}</span>
              <span>·</span>
              <span>{post.format}</span>
              <span>·</span>
              <span className={`status${s.attn ? ' attn' : ''}`}>
                <Dia color={s.color} size={7} />
                {post.status}
              </span>
            </div>
          </div>

          <div className="sec">
            <div className="sec-label">Brief / wytyczne</div>
            {isAdmin ? (
              <textarea
                className="field"
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Wytyczne dla pracownika — możesz wkleić linki do materiałów…"
              />
            ) : (
              <div className="plain">
                {post.brief ? linkify(post.brief) : <span className="muted">Brak briefu.</span>}
              </div>
            )}
          </div>

          <div className="sec">
            <div className="sec-label">Treść posta{hasLi ? ' — Meta (IG / FB)' : ''}</div>
            <textarea
              className="field"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Gotowa treść posta…"
              readOnly={isAdmin}
            />
          </div>

          {hasLi && (
            <div className="sec">
              <div className="sec-label">
                Wariant LinkedIn <span className="opt-hint">— opcjonalny</span>
              </div>
              <textarea
                className="field"
                rows={3}
                value={contentLi}
                onChange={(e) => setContentLi(e.target.value)}
                placeholder="Wypełnij tylko, jeśli wersja LinkedIn ma się różnić od Mety"
                readOnly={isAdmin}
              />
            </div>
          )}

          <div className="sec">
            <div className="sec-label">Grafika / materiał</div>
            {isAdmin ? (
              post.graphic_url ? (
                <div className="plain">
                  <a href={post.graphic_url} target="_blank" rel="noreferrer noopener">
                    {post.graphic_url}
                  </a>
                </div>
              ) : (
                <div className="plain muted">brak — pracownik doda link</div>
              )
            ) : (
              <input
                className="field"
                value={graphic}
                onChange={(e) => setGraphic(e.target.value)}
                placeholder="Link do Canvy / Drive"
              />
            )}
          </div>

          {post.post_comments && post.post_comments.length > 0 && (
            <div className="sec">
              <div className="sec-label">Uwagi do poprawy</div>
              {[...post.post_comments]
                .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
                .map((cm) => (
                  <div className="comment" key={cm.id}>
                    <b>{cm.author?.display_name ?? 'Admin'}:</b> {cm.body}
                    <span className="when">{fmtWhen(cm.created_at)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          {/* Zapis edytowalnych pol */}
          {dirty && (
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </button>
          )}
          {saved && !dirty && <span className="saved-hint">Zapisano ✓</span>}

          {/* Akcje workflow */}
          <Actions
            post={post}
            isAdmin={isAdmin}
            busy={busy}
            showFix={showFix}
            onShowFix={() => setShowFix(true)}
            onTransition={transition}
          />

          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}

          {/* Pole uwag (Do poprawy) */}
          {showFix && (
            <div className="fix-area">
              <input
                className="field"
                value={fixText}
                onChange={(e) => setFixText(e.target.value)}
                placeholder="Co poprawić? (wymagane)"
                autoFocus
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 10 }}
                onClick={sendFix}
                disabled={busy || !fixText.trim()}
              >
                Wyślij uwagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Actions({
  post,
  isAdmin,
  busy,
  showFix,
  onShowFix,
  onTransition,
}: {
  post: Post
  isAdmin: boolean
  busy: boolean
  showFix: boolean
  onShowFix: () => void
  onTransition: (s: PostStatus) => void
}) {
  if (isAdmin) {
    if (post.status === 'Do akceptacji') {
      return (
        <>
          <button className="btn btn-mint" disabled={busy} onClick={() => onTransition('Zaakceptowany')}>
            Akceptuj
          </button>
          {!showFix && (
            <button className="btn btn-line" disabled={busy} onClick={onShowFix}>
              Do poprawy
            </button>
          )}
        </>
      )
    }
    return (
      <span className="note" style={{ marginLeft: 0 }}>
        Akcje pojawią się przy statusie „Do akceptacji”.
      </span>
    )
  }
  // worker
  if (post.status === 'Zaplanowany') {
    return (
      <button className="btn btn-primary" disabled={busy} onClick={() => onTransition('W przygotowaniu')}>
        Zacznij pracę
      </button>
    )
  }
  if (post.status === 'W przygotowaniu' || post.status === 'Do poprawy') {
    return (
      <button className="btn btn-primary" disabled={busy} onClick={() => onTransition('Do akceptacji')}>
        Wyślij do akceptacji
      </button>
    )
  }
  if (post.status === 'Zaakceptowany') {
    return (
      <button className="btn btn-mint" disabled={busy} onClick={() => onTransition('Opublikowany')}>
        Oznacz: Opublikowany
      </button>
    )
  }
  return (
    <span className="note" style={{ marginLeft: 0 }}>
      Brak akcji.
    </span>
  )
}
