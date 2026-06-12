import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await signIn(email.trim(), password)
    if (error) setErr('Nie udało się zalogować. Sprawdź e-mail i hasło.')
    setBusy(false)
  }

  return (
    <div className="center-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <img src="/logo-twistedpixel.png" alt="Twisted Pixel" />
        <h1>
          Planner <span style={{ color: 'var(--accent)' }}>— postów</span>
        </h1>
        <div className="sub">Zaloguj się, aby kontynuować.</div>

        <label className="flbl" htmlFor="email">E-mail</label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="flbl" htmlFor="password">Hasło</label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && <div className="err">{err}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  )
}
