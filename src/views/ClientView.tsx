import { useMemo, useState, type KeyboardEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort, displayStatus, needsFix, freqText } from '../lib/helpers'
import { PLAT_LABEL } from '../lib/constants'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Client, Post } from '../lib/types'

interface Props {
  client: Client
  onOpenPost: (id: string) => void
  onNewPost: () => void
  onEditClient: () => void
  onOpenSeries: (id: string) => void
  onDeleted: () => void
}

type Filter = 'Wszystkie' | 'Zaplanowany' | 'Do poprawek' | 'Do akceptacji' | 'Zaakceptowany' | 'Opublikowany'
const FILTERS: Filter[] = ['Wszystkie', 'Zaplanowany', 'Do poprawek', 'Do akceptacji', 'Zaakceptowany', 'Opublikowany']

export function ClientView({ client, onOpenPost, onNewPost, onEditClient, onOpenSeries, onDeleted }: Props) {
  const { items, series, clientRules, createClientRule, deleteClientRule, deleteClient } = usePlanner()
  const { isAdmin, profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('Wszystkie')
  const [newRule, setNewRule] = useState('')
  const [savingRule, setSavingRule] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const posts = useMemo(() => items.filter((p) => p.client_id === client.id), [items, client.id])
  const rules = useMemo(() => clientRules.filter((r) => r.client_id === client.id), [clientRules, client.id])
  const cycles = useMemo(() => series.filter((s) => s.client_id === client.id), [series, client.id])

  const cnt = (s: Post['status']) => posts.filter((p) => p.status === s).length
  const cntFix = posts.filter(needsFix).length
  const canDeleteClient = isAdmin || client.created_by === profile?.id

  const match = (p: Post): boolean => {
    if (filter === 'Wszystkie') return true
    if (filter === 'Do poprawek') return needsFix(p)
    if (filter === 'Zaplanowany') return p.status === 'Zaplanowany' && !needsFix(p)
    return p.status === filter
  }
  const shown = useMemo(() => posts.filter(match).sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)), [posts, filter])

  async function addRule() {
    const body = newRule.trim()
    if (!body || savingRule) return
    setSavingRule(true)
    const e = await createClientRule(client.id, body)
    setSavingRule(false)
    if (!e) setNewRule('')
  }
  const onRuleKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{client.name}</h1>
          <div className="tagline">{client.platforms.map((p) => <span key={p}>/{PLAT_LABEL[p].toLowerCase()}</span>)}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-line" onClick={onEditClient}>Edytuj klienta</button>
          <button className="btn btn-primary" onClick={onNewPost}>+ Zaplanuj post</button>
        </div>
      </div>

      <div className="rules">
        <div className="rlabel">Zasady prowadzenia — pamiętaj <span className="hint">wpisujesz tekst, romb dodaje się sam</span></div>
        <ul>
          {rules.length === 0 && <li style={{ color: 'var(--ink-3)' }}>Brak zasad — dodaj pierwszy punkt poniżej.</li>}
          {rules.map((r) => {
            const can = isAdmin || r.created_by === profile?.id
            return (
              <li key={r.id}>
                <Dia color="#eb5d1c" />
                <span>{r.body}</span>
                {can ? <span className="rdel" title="Usuń punkt" onClick={() => deleteClientRule(r.id)}>✕</span> : <span className="rlock" title="Dodane przez admina">admin</span>}
              </li>
            )
          })}
        </ul>
        <div className="radd">
          <input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={onRuleKey} placeholder="Dodaj zasadę / podpunkt i naciśnij Enter…" />
          <button className="btn btn-line btn-sm" onClick={addRule} disabled={savingRule || !newRule.trim()}>+ Dodaj punkt</button>
        </div>
      </div>

      {cycles.length > 0 && (
        <div className="crecur">
          <span className="lab">Cykliczne</span>
          {cycles.map((s) => (
            <span className="item" key={s.id} style={{ cursor: 'pointer' }} onClick={() => onOpenSeries(s.id)}>
              <Dia color={client.color} size={7} /><span className="rtag">♻</span><b>{s.title}</b><span className="w">{freqText(s)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="statline">
        <span><b>{posts.length}</b> w sumie</span>
        <span className="warn"><b>{cnt('Do akceptacji')}</b> do akceptu</span>
        {cntFix > 0 && <span className="warn"><b>{cntFix}</b> do poprawek</span>}
        <span><b>{cnt('Zaakceptowany')}</b> do publikacji</span>
        <span><b>{cnt('Opublikowany')}</b> opublikowane</span>
      </div>

      <div className="filters">
        {FILTERS.map((f) => <span key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</span>)}
      </div>

      <div>
        <div className="trow head"><div>Data</div><div>Post</div><div className="hide-m">Platformy</div><div className="hide-m">Format</div><div>Status</div><div /></div>
        {shown.length === 0 && <div className="trow" style={{ cursor: 'default', color: 'var(--ink-3)' }}>Brak postów dla tego filtra.</div>}
        {shown.map((p) => {
          const s = displayStatus(p)
          return (
            <div key={p.id} className={`trow${p.status === 'Opublikowany' ? ' done' : ''}`} onClick={() => onOpenPost(p.id)}>
              <div className="t-date">{fmtDateShort(p.publish_date)}</div>
              <div className="t-title">{p.recur_id && <span className="rtag">♻</span>} {p.title}</div>
              <div className="plats hide-m">{p.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}</div>
              <div className="fmt hide-m">{p.format}</div>
              <div><span className={`status${s.attn ? ' attn' : ''}`}><Dia color={s.color} size={7} />{s.label}</span></div>
              <div className="go">⟶</div>
            </div>
          )
        })}
      </div>

      <div className="danger-zone">
        {canDeleteClient
          ? <span className="del-link" onClick={() => setConfirmDel(true)}>Usuń klienta „{client.name}" wraz ze wszystkimi jego postami</span>
          : <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Klienta dodanego przez admina może usunąć tylko admin.</span>}
      </div>

      {confirmDel && (
        <ConfirmDialog
          title="Usunąć klienta?"
          message={`Klient „${client.name}" zostanie usunięty wraz z postami, seriami i zasadami. Tej operacji nie można cofnąć.`}
          confirmLabel="Usuń klienta"
          onConfirm={async () => { const e = await deleteClient(client.id); if (!e) onDeleted(); return e }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  )
}
