import { useState } from 'react'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Usuń',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<string | null> | void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setErr(null)
    const res = await onConfirm()
    setBusy(false)
    if (typeof res === 'string' && res) setErr(res)
    else onCancel()
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <div><h3>{title}</h3></div>
          <button className="x" onClick={onCancel} aria-label="Zamknij">✕</button>
        </div>
        <div className="modal-body">
          <div className="plain">{message}</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy ? 'Usuwanie…' : confirmLabel}
          </button>
          <button className="btn btn-line" onClick={onCancel} disabled={busy}>Anuluj</button>
          {err && <span className="err" style={{ marginBottom: 0 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
