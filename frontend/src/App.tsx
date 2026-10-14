import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from './lib/api'
import CatalogScreen from './components/CatalogScreen'
import LoginScreen from './components/LoginScreen'
import WaitingRoom from './components/WaitingRoom'
import ProjectionScreen from './components/ProjectionScreen'
import WelcomeScreen from './components/WelcomeScreen'

type Screen = 'checking-session' | 'login' | 'welcome' | 'catalog' | 'waiting-room'
type Teacher = { email: string }
type NewSession = { code: string }

function TeacherApp() {
  const [screen, setScreen] = useState<Screen>('checking-session')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  useEffect(() => {
    let isMounted = true
    apiRequest<Teacher>('/auth/me')
      .then((teacher) => {
        if (!isMounted) return
        setTeacherEmail(teacher.email)
        setScreen('welcome')
      })
      .catch(() => { if (isMounted) setScreen('login') })
    return () => { isMounted = false }
  }, [])

  async function createClassroomSession() {
    setIsCreatingSession(true)
    setSessionError('')
    try {
      const session = await apiRequest<NewSession>('/sessions', { method: 'POST' })
      setSessionCode(session.code)
      setScreen('waiting-room')
    } catch (error) {
      setSessionError(error instanceof ApiError && error.status === 401
        ? 'Tu sesión docente expiró. Vuelve a iniciar sesión.'
        : 'No se pudo crear la sesión. Revisa que Serena.Api esté activa e inténtalo de nuevo.')
    } finally {
      setIsCreatingSession(false)
    }
  }

  async function logout() {
    try { await apiRequest<void>('/auth/logout', { method: 'POST' }) } catch { /* La sesión local también se cierra. */ }
    setTeacherEmail('')
    setSessionCode('')
    setScreen('login')
  }

  if (screen === 'checking-session') {
    return <main className="grid min-h-screen place-items-center text-sm text-gray-500">Cargando Serena…</main>
  }

  if (screen === 'login') {
    return <LoginScreen onLogin={(email) => { setTeacherEmail(email); setScreen('welcome') }} />
  }

  if (screen === 'catalog') {
    return (
      <CatalogScreen
        teacherEmail={teacherEmail}
        isCreatingSession={isCreatingSession}
        sessionError={sessionError}
        onLogout={logout}
        onNarrativeSelect={() => { void createClassroomSession() }}
      />
    )
  }

  if (screen === 'waiting-room') {
    return <WaitingRoom sessionCode={sessionCode} onLogout={logout} onReturnToChapters={() => setScreen('catalog')} />
  }

  return <WelcomeScreen onContinue={() => setScreen('catalog')} />
}
export default function App() {
  const match = window.location.pathname.match(/^\/projection\/(\d{6})\/?$/)
  return match ? <ProjectionScreen sessionCode={match[1]} /> : <TeacherApp />
}
