import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from './lib/api'
import CatalogScreen from './components/CatalogScreen'
import IntroductionScreen from './components/IntroductionScreen'
import LoginScreen from './components/LoginScreen'
import WaitingRoom from './components/WaitingRoom'
import WelcomeScreen from './components/WelcomeScreen'

type Screen = 'checking-session' | 'login' | 'welcome' | 'catalog' | 'waiting-room' | 'introduction'
type Teacher = { email: string }
type NewSession = { code: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>('checking-session')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isStartingNarrative, setIsStartingNarrative] = useState(false)

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

  async function startNarrative() {
    setIsStartingNarrative(true)
    try {
      await apiRequest(`/sessions/${sessionCode}/narrative/start`, { method: 'POST' })
      setScreen('introduction')
    } catch {
      setSessionError('No se pudo iniciar la narrativa. Verifica que Serena.Api esté activa e inténtalo de nuevo.')
    } finally {
      setIsStartingNarrative(false)
    }
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
    return <WaitingRoom sessionCode={sessionCode} onLogout={logout} onReturnToChapters={() => setScreen('catalog')} onStartNarrative={() => { void startNarrative() }} isStartingNarrative={isStartingNarrative} />
  }

  if (screen === 'introduction') return <IntroductionScreen onReturnToChapters={() => setScreen('catalog')} />

  return <WelcomeScreen onContinue={() => setScreen('catalog')} />
}
