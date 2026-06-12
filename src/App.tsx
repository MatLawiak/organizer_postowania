import { useAuth } from './auth/AuthContext'
import { Login } from './auth/Login'
import { PlannerProvider } from './data/PlannerContext'
import { AppShell } from './components/AppShell'

export function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="center-screen muted">Ładowanie…</div>
  }
  if (!session) {
    return <Login />
  }
  return (
    <PlannerProvider>
      <AppShell />
    </PlannerProvider>
  )
}
