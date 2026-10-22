import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '../lib/api'
import SupervisionPanel, { type SupervisionStudent } from './SupervisionPanel'

type Student = { id: string; name: string; connected: boolean; ready: boolean }
type StudentInteraction = SupervisionStudent
type NarrativeState = {
  narrativeStarted: boolean
  stage: number
  stageLabel: string
  stageDescription: string
  introCompletedStudents: number
  revision: number
  connectedStudents: number
  readyStudents: number
  advanceMode: 'automatic' | 'vote'
  votingOpen: boolean
  continueVotes: number
  alternativeVotes: number
  finalDecision: 'continue' | 'vote' | null
  voteRound: number
  emotionCounts?: Record<string, number>
  decisionCounts?: Record<string, number>
}
type WaitingRoomProps = { sessionCode: string; onLogout: () => void; onReturnToChapters: () => Promise<void> }

const initialNarrativeState: NarrativeState = {
  narrativeStarted: false, stage: 0, stageLabel: 'En espera',
  stageDescription: 'Esperando a que el docente inicie la experiencia.',
  revision: 0, connectedStudents: 0, readyStudents: 0, introCompletedStudents: 0,
  advanceMode: 'automatic', votingOpen: false, continueVotes: 0, alternativeVotes: 0, finalDecision: null, voteRound: 0,
  emotionCounts: {}, decisionCounts: {},
}
const shortcuts = [
  { key: 'ESPACIO', description: 'Reproducir o pausar la narrativa' },
  { key: '→', description: 'Avanzar 5 segundos' },
  { key: '←', description: 'Retroceder 5 segundos' },
  { key: 'M', description: 'Activar o silenciar el audio' },
  { key: 'F', description: 'Entrar en pantalla completa' },
  { key: 'ESC', description: 'Salir de pantalla completa' },
  { key: '↑ / ↓', description: 'Subir o bajar el volumen' },
]

function NarrativeControls({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 md:justify-end md:pt-24 md:pr-8">
      <button type="button" aria-label="Cerrar menú de controles" onClick={onClose} className="fixed inset-0 cursor-default" />
      <aside id="narrative-controls" role="dialog" aria-modal="true" aria-labelledby="controls-title" className="relative z-10 my-auto w-full max-w-[420px] rounded-2xl bg-[#463535] p-5 text-white shadow-2xl sm:p-6">
        <button type="button" onClick={onClose} aria-label="Cerrar controles" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white/80 hover:bg-white/20">×</button>
        <h2 id="controls-title" className="pr-12 text-xl font-extrabold sm:text-2xl">Controles de la narrativa</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/75">Atajos de teclado para manejar la proyección.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex min-h-[68px] items-center gap-3 rounded-lg bg-white/[0.08] px-3 py-3">
              <kbd className="flex min-h-9 min-w-11 shrink-0 items-center justify-center rounded-md bg-[#723b3e] px-2 text-xs font-bold">{shortcut.key}</kbd>
              <p className="text-sm leading-snug text-white/90">{shortcut.description}</p>
            </div>
          ))}
        </div>
        <footer className="mt-5 rounded-lg border border-[#9b5658] bg-[#542f30] px-3 py-3">
          <p className="text-sm font-bold">Consejo</p>
          <p className="mt-1 text-sm text-white/85">Revisa estos controles antes de iniciar la proyección.</p>
        </footer>
      </aside>
    </div>
  )
}

export default function WaitingRoom({ sessionCode, onLogout, onReturnToChapters }: WaitingRoomProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [narrativeState, setNarrativeState] = useState(initialNarrativeState)
  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isSkippingIntro, setIsSkippingIntro] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [isSettingAdvanceMode, setIsSettingAdvanceMode] = useState(false)
  const [studentInteractions, setStudentInteractions] = useState<StudentInteraction[]>([])
  const [isSupervisionOpen, setIsSupervisionOpen] = useState(true)

  const [actionError, setActionError] = useState('')
  const [projectionPath, setProjectionPath] = useState('')
  const connectedStudents = students.filter((student) => student.connected).length
  const readyStudents = students.filter((student) => student.connected && student.ready).length
  const currentInteraction = narrativeState.stage === 2 ? 'emotion' : narrativeState.stage === 5 ? 'reflection' : narrativeState.stage >= 3 ? 'decision' : null
  const activeInteractions = studentInteractions.filter((student) => student.connected)
  const respondedStudents = activeInteractions.filter((student) => currentInteraction && student[currentInteraction]).length

  useEffect(() => {
    let disposed = false
    let retryTimer = 0
    let stream: WebSocket | null = null
    const refreshInteractions = async () => {
      try {
        const current = await apiRequest<StudentInteraction[]>('/sessions/' + sessionCode + '/interactions')
        if (!disposed) setStudentInteractions(current)
      } catch { /* Mantiene los últimos datos recibidos si no se puede actualizar. */ }
    }
    const connect = () => {
      if (disposed) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      stream = new WebSocket(protocol + '//' + window.location.host + '/api/sessions/' + sessionCode + '/stream')
      stream.onopen = () => { setIsLive(true); void refreshInteractions() }
      stream.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as {
            type: string
            students?: Student[]
            student?: Student
            state?: NarrativeState
          }
          if (payload.type === 'snapshot' && payload.students) setStudents(payload.students)
          if (payload.type === 'student-status' && payload.student) {
            void refreshInteractions()
            setStudents((current) => {
              const index = current.findIndex((student) => student.id === payload.student!.id)
              if (index < 0) return [...current, payload.student!]
              const updated = [...current]
              updated[index] = payload.student!
              return updated
            })
          }
          if (payload.type === 'narrative-state' && payload.state) {
            setNarrativeState(payload.state)
            void refreshInteractions()
          }
        } catch { /* Conserva el último estado válido. */ }
      }
      stream.onclose = () => {
        setIsLive(false)
        if (!disposed) retryTimer = window.setTimeout(connect, 1200)
      }
      stream.onerror = () => stream?.close()
    }
    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      stream?.close()
    }
  }, [sessionCode])

  async function startExperience() {
    const projectionWindow = window.open('about:blank', '_blank')
    setIsStarting(true)
    setActionError('')
    try {
      const state = await apiRequest<NarrativeState>('/sessions/' + sessionCode + '/start', {
        method: 'POST',
      })
      setNarrativeState(state)
      const path = '/projection/' + sessionCode
      setProjectionPath(path)
      if (projectionWindow) projectionWindow.location.href = path
    } catch (error) {
      projectionWindow?.close()
      setActionError(error instanceof ApiError && error.status === 409
        ? (readyStudents < connectedStudents ? 'Espera a que todos los estudiantes conectados estén listos.' : 'Conecta al menos un estudiante para iniciar la experiencia.')
        : 'No se pudo iniciar la narrativa. Revisa la conexión con el servidor.')
    } finally {
      setIsStarting(false)
    }
  }

  async function skipIntroduction() {
    setIsSkippingIntro(true)
    setActionError('')
    try {
      const state = await apiRequest<NarrativeState>('/sessions/' + sessionCode + '/skip-intro', { method: 'POST' })
      setNarrativeState(state)
    } catch (error) {
      setActionError(error instanceof ApiError
        ? error.status === 404
          ? 'Serena.Api aún no tiene activa la ruta para omitir. Reinicia la API; esto borrará las sesiones actuales.'
          : error.status === 409
            ? 'La introducción ya terminó o no hay estudiantes conectados.'
            : error.status === 401
              ? 'La sesión docente expiró. Inicia sesión de nuevo.'
              : 'No se pudo omitir la introducción. Verifica la conexión e inténtalo de nuevo.'
        : 'No se pudo omitir la introducción. Verifica la conexión e inténtalo de nuevo.')
    } finally {
      setIsSkippingIntro(false)
    }
  }

  async function setAdvanceMode(mode: 'automatic' | 'vote') {
    setIsSettingAdvanceMode(true)
    setActionError('')
    try {
      const state = await apiRequest<NarrativeState>('/sessions/' + sessionCode + '/advance-mode', {
        method: 'POST', body: JSON.stringify({ mode }),
      })
      setNarrativeState(state)
    } catch {
      setActionError('No se pudo actualizar la decisión final. Verifica la conexión con la sesión.')
    } finally {
      setIsSettingAdvanceMode(false)
    }
  }

  async function returnToChapters() {
    setIsReturning(true)
    setActionError('')
    try { await onReturnToChapters() }
    catch (error) {
      setActionError(error instanceof ApiError && error.status === 404
        ? 'La API no reconoce la orden de detener la narrativa. Reinicia Serena.Api e inténtalo de nuevo.'
        : 'No se pudo detener la narrativa. Verifica la sesión y la conexión e inténtalo de nuevo.')
    }
    finally { setIsReturning(false) }
  }


  const connectionCode = sessionCode.match(/.{1,3}/g)?.join(' ') ?? sessionCode

  return (
    <main className="min-h-screen bg-white px-4 py-5 text-gray-950 sm:px-8">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="text-sm font-medium text-gray-800 hover:text-red-700 disabled:opacity-50">{isReturning ? 'Deteniendo narrativa…' : '← Volver a capítulos'}</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onLogout} className="text-sm font-medium text-gray-600 hover:text-red-700">Cerrar sesión</button>
          <button type="button" onClick={() => setIsControlsOpen(true)} aria-label="Ver controles de teclado" aria-expanded={isControlsOpen} title="Ver controles de teclado" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 font-bold text-white hover:bg-slate-800">?</button>
        </div>
      </header>

      {narrativeState.narrativeStarted && (
        <div className="sticky top-2 z-20 mx-auto mt-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Participación del grupo">
            <span><strong>{connectedStudents}</strong> conectados</span>
            <span><strong>{respondedStudents}</strong> respondieron</span>
            <span><strong>{Math.max(0, connectedStudents - respondedStudents)}</strong> pendientes</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSupervisionOpen((open) => !open)}
            aria-expanded={isSupervisionOpen}
            aria-controls="supervision-panel"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            {isSupervisionOpen ? 'Ocultar supervisión' : 'Abrir supervisión'}
          </button>
        </div>
      )}

      <section className="mx-auto mt-12 w-full max-w-5xl sm:mt-20">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold text-black">Sala de espera</h1>
          <p className="mt-2 text-base font-medium text-gray-600">Capítulo 1: Narrativa 1</p>
          <p className="mt-3 text-sm text-gray-500">{isLive ? 'Conexión en tiempo real activa' : 'Reconectando con la sesión…'}</p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="min-h-[250px] rounded-2xl border border-gray-100 p-7 shadow-sm">
            <h2 className="text-base font-bold">Código de conexión</h2>
            <p className="mt-8 text-5xl font-black tracking-[0.15em] text-red-600 sm:text-6xl">{connectionCode}</p>
            <p className="mt-3 text-sm text-gray-600">Estudiantes conectados: {connectedStudents}</p>
            <p className="text-sm text-gray-600">Marcados como listos: {readyStudents}</p>
          </section>

          <section className="min-h-[250px] rounded-2xl border border-gray-100 p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Estudiantes</h2>
              <span className="text-sm text-gray-500">{connectedStudents}/12 conectados</span>
            </div>
            <div className="mt-5 space-y-3">
              {students.length === 0 && <p className="text-sm text-gray-500">Esperando que se conecte el primer estudiante.</p>}
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={'h-3 w-3 shrink-0 rounded-full ' + (student.connected ? 'bg-emerald-500' : 'bg-red-500')} />
                    <span className="truncate">{student.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{!student.connected ? 'Desconectado' : student.ready ? 'Listo' : 'Conectado'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {!narrativeState.narrativeStarted ? (
          <section className="mx-auto mt-7 max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-5">
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
            <button type="button" onClick={() => void startExperience()} disabled={connectedStudents < 1 || readyStudents < connectedStudents || isStarting} className="mt-4 w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isStarting ? 'Iniciando…' : connectedStudents < 1 ? 'Conecta al menos un estudiante' : readyStudents < connectedStudents ? 'Esperando estudiantes listos (' + readyStudents + '/' + connectedStudents + ')' : 'Iniciar experiencia y abrir proyección'}
            </button>
          </section>
        ) : (
          <section className="mx-auto mt-7 max-w-2xl rounded-xl border border-red-100 bg-red-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Experiencia en curso</p>
                <h2 className="mt-1 text-lg font-bold">{narrativeState.stage === 0 ? "Introducción en curso" : narrativeState.stageLabel + " · Etapa " + narrativeState.stage + " de 5"}</h2>
              </div>
              {projectionPath && <a href={projectionPath} target="_blank" rel="noreferrer" className="text-sm font-semibold text-red-700 underline">Abrir proyección</a>}
            </div>
            <p className="mt-3 text-sm text-gray-600">{narrativeState.stageDescription}</p>
            {narrativeState.stage < 5 && (
              <fieldset className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-bold text-gray-900">Modo de avance al cierre</legend>
                <p className="text-sm text-gray-600">Configúralo antes de terminar la narrativa. Puedes cambiarlo durante la experiencia.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void setAdvanceMode('automatic')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.advanceMode === 'automatic'} className={'rounded-lg border px-4 py-3 text-left disabled:opacity-60 ' + (narrativeState.advanceMode === 'automatic' ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600' : 'border-gray-300 bg-white hover:bg-gray-50')}>
                    <strong className="block text-sm">Avance automático</strong>
                    <span className="mt-1 block text-xs text-gray-600">El cierre se realiza sin solicitar votos al grupo.</span>
                  </button>
                  <button type="button" onClick={() => void setAdvanceMode('vote')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.advanceMode === 'vote'} className={'rounded-lg border px-4 py-3 text-left disabled:opacity-60 ' + (narrativeState.advanceMode === 'vote' ? 'border-red-600 bg-red-50 ring-2 ring-red-600' : 'border-gray-300 bg-white hover:bg-gray-50')}>
                    <strong className="block text-sm">Votación grupal</strong>
                    <span className="mt-1 block text-xs text-gray-600">Al llegar al cierre, cada estudiante decide desde su tablet.</span>
                  </button>
                </div>
              </fieldset>
            )}
            <p className="mt-2 text-sm text-gray-600">Introducción terminada en tablets: {narrativeState.introCompletedStudents}/{connectedStudents}</p>
            {narrativeState.stage === 0 && <button type="button" onClick={() => void skipIntroduction()} disabled={isSkippingIntro || connectedStudents === 0} className="mt-4 w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">{isSkippingIntro ? 'Omitiendo introducción…' : 'Omitir introducción'}</button>}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          </section>
        )}
        {narrativeState.narrativeStarted && narrativeState.stage === 5 && (
          <section aria-labelledby="final-decision-title" className="mx-auto mt-5 max-w-5xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Cierre de la narrativa</p>
            <h2 id="final-decision-title" className="mt-2 text-2xl font-extrabold text-gray-950">¿Cómo continúa el grupo?</h2>
            <p className="mt-1 text-sm text-gray-600">La etapa 5 es el cierre de esta narrativa. Elige continuar o abrir una votación grupal.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <button type="button" onClick={() => void setAdvanceMode('automatic')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.finalDecision === 'continue'} className={'min-h-40 rounded-xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 ' + (narrativeState.finalDecision === 'continue' ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600' : 'border-gray-200 bg-white')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">→</span>
                <strong className="mt-4 block text-lg">Avanzar sin votación</strong>
                <span className="mt-1 block text-sm text-gray-600">El cierre continúa sin consultar al grupo y permite volver al catálogo.</span>
              </button>
              <button type="button" onClick={() => void setAdvanceMode('vote')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.votingOpen} className={'min-h-40 rounded-xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 ' + (narrativeState.votingOpen ? 'border-red-600 bg-red-50 ring-2 ring-red-600' : 'border-gray-200 bg-white')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-700">◎</span>
                <strong className="mt-4 block text-lg">Dejarlo a votación</strong>
                <span className="mt-1 block text-sm text-gray-600">Cada estudiante elige en su tablet si continúa o explora una alternativa.</span>
              </button>
            </div>
            {narrativeState.votingOpen && <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800" aria-live="polite">Votos recibidos: {narrativeState.continueVotes} continuar · {narrativeState.alternativeVotes} explorar otra decisión</p>}
            {narrativeState.finalDecision === 'continue' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-900">Avance automático configurado. No se abrirá una votación grupal.</p>
                <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{isReturning ? 'Volviendo al catálogo…' : 'Finalizar y volver al catálogo'}</button>
              </div>
            )}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          </section>
        )}
        {isSupervisionOpen && narrativeState.narrativeStarted && narrativeState.stage >= 2 && (
          <SupervisionPanel
            stage={narrativeState.stage}
            connected={connectedStudents}
            students={studentInteractions}
            liveCounts={narrativeState.stage === 2 ? narrativeState.emotionCounts : narrativeState.stage === 5 ? undefined : narrativeState.decisionCounts}
          />
        )}
      </section>
      {isControlsOpen && <NarrativeControls onClose={() => setIsControlsOpen(false)} />}
    </main>
  )
}
