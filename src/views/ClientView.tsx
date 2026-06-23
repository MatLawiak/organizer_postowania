import { useMemo, useState, type KeyboardEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePlanner } from '../data/PlannerContext'
import { Dia, fmtDateShort, displayStatus } from '../lib/helpers'
import { PLAT_LABEL, WEEKDAYS_PL_CO } from '../lib/constants'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Client, Post } from '../lib/types'

interface Props {
  client: Client
  onOpenPost: (id: string) => void
  onNewPost: () => void
  onDeleted: () => void
}

type Filter = 'Wszystkie' | 'Zaplanowany' | 'Do poprawek' | 'Do akceptacji' | 'Zaakceptowany' | 'Opublikowany'
const FILTERS: Filter[] = ['Wszystkie', 'Zaplanowany', 'Do poprawek', 'Do akceptacji', 'Zaakceptowany', 'Opublikowany']

const isDoPoprawek = (p: Post) => p.status === 'Zaplanowany' && (p.post_comments?.length ?? 0) > 0

export function ClientView({ client, onOpenPost, onNewPost, onDeleted }: Props) {
  const { posts, recurringTasks, clientRules, createClientRule, deleteClientRule, deleteClient } = usePlanner()
  const { isAdmin, profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('Wszystkie')
  const [newRule, setNewRule] = useState('')
  const [savingRule, setSavingRule] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const clientPosts = useMemo(() => posts.filter((p) => p.client_id === client.id), [posts, client.id])
  const rules = useMemo(() => clientRules.filter((r) => r.client_id === client.id), [clientRules, client.id])
  const cycles = useMemo(() => recurringTasks.filter((t) => t.client_id === client.id), [recurringTasks, client.id])

  const cntStatus = (s: Post['status']) => clientPosts.filter((p) => p.status === s).length
  const cntPoprawek = clientPosts.filter(isDoPoprawek).length

  const matchFilter = (p: Post): boolean => {
    switch (filter) {
      case 'Wszystkie': return true
      case 'Do poprawek': return isDoPoprawek(p)
      case 'Zaplanowany': return p.status === 'Zaplanowany' && !isDoPoprawek(p)
      default: return p.status === filter
    }
  }

  const shown = useMemo(
    () => clientPosts.filter(matchFilter).sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1)),
    [clientPosts, filter],
  )

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
          <div className="tagline">
            {client.platforms.map((p) => <span key={p}>/{PLAT_LABEL[p].toLowerCase()}</span>)}
          </div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={onNewPost}>+ Zaplanuj post</button>}
      </div>

      {/* ZASADY PROWADZENIA — zawsze widoczne */}
      <div className="rules-block">
        <div className="rules-head">Zasady prowadzenia — pamiętaj</div>
        {rules.length === 0 && <div className="muted" style={{ marginBottom: 8 }}>Brak zasad — dodaj pierwszą poniżej.</div>}
        {rules.map((r) => {
          const canDelete = isAdmin || r.created_by === profile?.id
          return (
            <div className="rule-row" key={r.id}>
              <Dia color="var(--accent)" size={7} />
              <span className="rule-body">{r.body}</span>
              {canDelete ? (
                <button className="rule-del" onClick={() => deleteClientRule(r.id)} aria-label="Usuń zasadę">✕</button>
              ) : (
                <span className="rule-owner">admin</span>
              )}
            </div>
          )
        })}
        <div className="rule-add">
          <input
            className="field"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={onRuleKey}
            placeholder="Dodaj zasadę / podpunkt i naciśnij Enter"
          />
          <button className="btn btn-line btn-sm" onClick={addRule} disabled={savingRule || !newRule.trim()}>Dodaj</button>
        </div>
      </div>

      {/* ZADANIA CYKLICZNE KLIENTA — jednolinijkowo */}
      {cycles.length > 0 && (
        <div className="client-cycles">
          {cycles.map((t) => (
            <span className="cycle-pill" key={t.id}>
              <Dia color="var(--accent)" size={6} />
              {t.label} · co {WEEKDAYS_PL_CO[t.weekday]}
              {t.description ? ` — ${t.description}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="statline">
        <span><b>{clientPosts.length}</b> łącznie</span>
        <span className="warn"><b>{cntStatus('Do akceptacji')}</b> do akceptu</span>
        <span className="warn"><b>{cntPoprawek}</b> do poprawek</span>
        <span><b>{cntStatus('Zaakceptowany')}</b> do publikacji</span>
        <span><b>{cntStatus('Opublikowany')}</b> opublikowane</span>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div>
        <div className="trow head">
          <div>Data</div><div>Post</div>
          <div className="hide-m">Platformy</div><div className="hide-m">Format</div>
          <div>Status</div><div />
        </div>
        {shown.length === 0 && (
          <div className="trow" style={{ cursor: 'default', color: 'var(--gray-l)' }}>Brak postów dla tego filtra.</div>
        )}
        {shown.map((p) => {
          const s = displayStatus(p)
          return (
            <div key={p.id} className="trow" onClick={() => onOpenPost(p.id)}>
              <div className="t-date">{fmtDateShort(p.publish_date)}</div>
              <div className="t-title">{p.title}</div>
              <div className="plats hide-m">{p.platforms.map((x) => PLAT_LABEL[x]).join(' · ')}</div>
              <div className="fmt hide-m">{p.format}</div>
              <div>
                <span className={`status${s.attn ? ' attn' : ''}`}>
                  <Dia color={s.color} size={7} />{s.label}
                </span>
              </div>
              <div className="go">⟶</div>
            </div>
          )
        })}
      </div>

      {/* USUN KLIENTA — tylko admin */}
      {isAdmin && (
        <div className="danger-zone">
          <button className="linkbtn danger" onClick={() => setConfirmDel(true)}>Usuń klienta…</button>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Usunąć klienta?"
          message={`Klient „${client.name}" zostanie usunięty wraz ze wszystkimi jego postami i zadaniami cyklicznymi. Tej operacji nie można cofnąć.`}
          confirmLabel="Usuń klienta"
          onConfirm={async () => {
            const e = await deleteClient(client.id)
            if (!e) onDeleted()
            return e
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  )
}
