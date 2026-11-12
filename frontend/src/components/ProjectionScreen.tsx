import { useEffect, useRef, useState } from 'react'
import { apiRequest, ApiError } from '../lib/api'
import SessionSummary from './SessionSummary'
import SupervisionPanel, { type SupervisionStudent } from './SupervisionPanel'

type ProjectionState = {
  active: boolean
  narrativeStarted: boolean
  stage: number
  stageLabel: string
  stageDescription: string
  revision: number
  mediaPaused: boolean
  mediaPositionSeconds: number
  mediaRevision: number
  mediaCommand: string
  volumePercent: number
  connectedStudents: number
  participantCount: number
  readyStudents: number
  introCompletedStudents: number
  emotionCounts?: Record<string, number>
  decisionCounts?: Record<string, number>
  advanceMode: 'automatic' | 'vote'
  votingOpen: boolean
  continueVotes: number
  alternativeVotes: number
  finalDecision: 'continue' | 'vote' | null
  voteRound: number
}
const initialState: ProjectionState = {
  active: true, narrativeStarted: false, stage: 0, stageLabel: 'En espera',
  stageDescription: 'Esperando a que el docente inicie la experiencia.',
  revision: 0, mediaPaused: true, mediaPositionSeconds: 0, mediaRevision: 0, mediaCommand: 'pause', volumePercent: 70,
  connectedStudents: 0, participantCount: 0, readyStudents: 0, introCompletedStudents: 0, emotionCounts: {}, decisionCounts: {},
  advanceMode: 'automatic', votingOpen: false, continueVotes: 0, alternativeVotes: 0, finalDecision: null, voteRound: 0,
}

export default function ProjectionScreen({ sessionCode }: { sessionCode: string }) {
  const [state, setState] = useState(initialState)
  const [error, setError] = useState('')
  const [isChangingStage, setIsChangingStage] = useState(false)
  const [isSkippingIntro, setIsSkippingIntro] = useState(false)
  const [isControllingMedia, setIsControllingMedia] = useState(false)
  const volumeTimer = useRef<number | undefined>(undefined)
  const [isReturning, setIsReturning] = useState(false)
  const [isOpeningFeedback, setIsOpeningFeedback] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [studentInteractions, setStudentInteractions] = useState<SupervisionStudent[]>([])
  const [mediaDuration, setMediaDuration] = useState(0)
  const introPending = state.connectedStudents === 0 || state.introCompletedStudents < state.connectedStudents
  const interactionKind = state.stage === 2 ? 'emotion' : state.stage === 3 ? 'decision' : null
  const groupedValues = interactionKind === 'emotion' ? (state.emotionCounts ?? {}) : (state.decisionCounts ?? {})
  const responseCount = Object.values(groupedValues).reduce((total, count) => total + count, 0)
  const highestCount = Math.max(0, ...Object.values(groupedValues))
  const connectedReflectionParticipants = studentInteractions.filter((student) => student.connected)
  const completedReflections = connectedReflectionParticipants.filter((student) => {
    const answers = student.reflection?.split(',').map((answer) => answer.trim().toLowerCase()) ?? []
    return answers.length === 4 && answers.every((answer) => answer === 'yes' || answer === 'no')
  }).length
  const allReflectionsSubmitted = connectedReflectionParticipants.length > 0
    && completedReflections === connectedReflectionParticipants.length

  useEffect(() => {
    let active = true
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = '/videos/narrativa-inicial.mp4'
    const readDuration = () => {
      if (active && Number.isFinite(video.duration)) setMediaDuration(video.duration)
    }
    video.addEventListener('loadedmetadata', readDuration)
    video.load()
    return () => {
      active = false
      video.removeEventListener('loadedmetadata', readDuration)
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  useEffect(() => {
    let active = true
    let retryTimer = 0
    const refresh = async () => {
      try {
        const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode)
        if (active) {
          setState((current) => ({ ...initialState, ...next, volumePercent: volumeTimer.current === undefined ? next.volumePercent : current.volumePercent }))
          setError('')
        }
      } catch {
        if (active) setError('No se pudo conectar con la sesión. Esperando al servidor…')
      } finally {
        if (active) retryTimer = window.setTimeout(() => void refresh(), 700)
      }
    }
    void refresh()
    return () => { active = false; window.clearTimeout(retryTimer); window.clearTimeout(volumeTimer.current) }
  }, [sessionCode])

  useEffect(() => {
    if (state.stage < 2) return
    let active = true
    const refreshInteractions = async () => {
      try {
        const interactions = await apiRequest<SupervisionStudent[]>('/sessions/' + sessionCode + '/interactions')
        if (active) setStudentInteractions(interactions)
      } catch { /* Conserva las respuestas mÃ¡s recientes mientras vuelve la conexiÃ³n. */ }
    }
    void refreshInteractions()
    const interval = window.setInterval(() => void refreshInteractions(), 1000)
    return () => { active = false; window.clearInterval(interval) }
  }, [sessionCode, state.stage])

  async function changeStage(direction: -1 | 1) {
    setIsChangingStage(true)
    setError('')
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/stage', {
        method: 'POST',
        body: JSON.stringify({ direction }),
      })
      setState(next)
    } catch {
      setError('No se pudo cambiar la etapa. Verifica que todos hayan terminado la introducción.')
    } finally {
      setIsChangingStage(false)
    }
  }

  async function skipIntroduction() {
    setIsSkippingIntro(true)
    setError('')
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/skip-intro', { method: 'POST' })
      setState(next)
    } catch (error) {
      setError(error instanceof ApiError
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

  async function controlMedia(action: 'pause' | 'play' | 'back-5' | 'forward-5') {
    setIsControllingMedia(true)
    setError('')
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/media', {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      setState(next)
    } catch (error) {
      setError(error instanceof ApiError
        ? error.status === 401
          ? 'La sesión docente expiró. Inicia sesión de nuevo.'
          : error.status === 404
            ? 'La API no encuentra esta sesión. Inicia una sesión nueva desde el catálogo.'
            : error.status === 409
              ? 'Los controles multimedia solo funcionan durante la Etapa 1.'
              : 'La API rechazó el control multimedia (HTTP ' + error.status + ').'
        : 'No se pudo conectar con Serena.Api. Revisa su terminal y vuelve a intentarlo.')
    } finally {
      setIsControllingMedia(false)
    }
  }

  function controlVolume(volumePercent: number) {
    setState((current) => ({ ...current, volumePercent }))
    window.clearTimeout(volumeTimer.current)
    volumeTimer.current = window.setTimeout(() => {
      void apiRequest<ProjectionState>('/sessions/' + sessionCode + '/media/volume', {
        method: 'POST',
        body: JSON.stringify({ volumePercent }),
      }).then((next) => setState((current) => ({ ...current, ...next })))
        .catch(() => setError('No se pudo actualizar el volumen de la narrativa.'))
        .finally(() => { volumeTimer.current = undefined })
    }, 180)
  }
  const mediaDurationSeconds = Math.max(0, Math.floor(mediaDuration))
  const reportedMediaTime = Math.max(0, Math.floor(state.mediaPositionSeconds || 0))
  const mediaTime = mediaDurationSeconds > 0 ? Math.min(reportedMediaTime, mediaDurationSeconds) : reportedMediaTime
  const mediaTimeLabel = `${Math.floor(mediaTime / 60).toString().padStart(2, '0')}:${(mediaTime % 60).toString().padStart(2, '0')}`
  const mediaDurationLabel = `${Math.floor(mediaDurationSeconds / 60).toString().padStart(2, '0')}:${(mediaDurationSeconds % 60).toString().padStart(2, '0')}`
  const mediaProgress = mediaDuration > 0 ? Math.min(100, (state.mediaPositionSeconds / mediaDuration) * 100) : 0

  async function returnToChapters() {
    setIsReturning(true)
    setError('')
    try {
      await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/reset', { method: 'POST' })
      window.location.href = '/?screen=catalog'
    } catch (error) {
      setError(error instanceof ApiError && error.status === 404
        ? 'La API no reconoce la orden de detener la narrativa. Reinicia Serena.Api e inténtalo de nuevo.'
        : 'No se pudo detener la narrativa. Verifica la sesión y la conexión e inténtalo de nuevo.')
      setIsReturning(false)
    }
  }

  async function openTeacherFeedback() {
    setIsOpeningFeedback(true)
    setError('')
    try {
      const interactions = await apiRequest<SupervisionStudent[]>('/sessions/' + sessionCode + '/interactions')
      setStudentInteractions(interactions)
      if (state.votingOpen) {
        setShowFeedback(true)
        return
      }
      const connected = interactions.filter((student) => student.connected)
      const complete = connected.length > 0 && connected.every((student) => {
        const answers = student.reflection?.split(',').map((answer) => answer.trim().toLowerCase()) ?? []
        return answers.length === 4 && answers.every((answer) => answer === 'yes' || answer === 'no')
      })
      if (!complete) {
        setError('Espera a que todos los estudiantes conectados completen las cuatro reflexiones antes de abrir la votaciÃ³n.')
        return
      }
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/open-vote', { method: 'POST' })
      setState(next)
      setShowFeedback(true)
    } catch (error) {
      setError(error instanceof ApiError && error.status === 401
        ? 'La sesi\u00f3n docente expir\u00f3. Inicia sesi\u00f3n de nuevo para ver la retroalimentaci\u00f3n.'
        : error instanceof ApiError && error.status === 409
          ? 'Todos los estudiantes conectados deben completar las cuatro reflexiones antes de abrir la votaci\u00f3n.'
          : 'No se pudieron cargar las respuestas de los estudiantes. Verifica la conexi\u00f3n e int\u00e9ntalo de nuevo.')
    } finally {
      setIsOpeningFeedback(false)
    }
  }

  async function repeatExperience() {
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/repeat', { method: 'POST' })
      setState(next)
      setShowFeedback(false)
    } catch (error) {
      throw new Error(error instanceof ApiError && error.status === 409
        ? 'The experience can only be repeated after stage 5.'
        : 'The experience could not be repeated. Check the session connection and try again.')
    }
  }

  async function finishAndSendReport() {
    try {
      await apiRequest<{ sent: boolean; email: string }>('/sessions/' + sessionCode + '/report', { method: 'POST' })
      window.location.assign('/?screen=catalog')
    } catch (error) {
      throw new Error(error instanceof ApiError && error.status === 503
        ? 'Email delivery is not configured in Serena.Api. Configure SMTP and try again.'
        : error instanceof ApiError && error.status === 502
          ? 'The report could not be sent. Check the Serena.Api SMTP settings.'
          : 'The session could not be finalized and the report was not sent. Check the connection and try again.')
    }
  }

  return (
    showFeedback
      ? <SessionSummary students={studentInteractions} votes={{ continue: state.continueVotes, alternative: state.alternativeVotes }} onRepeat={repeatExperience} onFinish={finishAndSendReport} />
      :
    <main className="flex min-h-screen flex-col bg-[#171717] text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-5 py-3 sm:px-8">
        <span className="text-lg font-bold text-red-500">Serena</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{state.connectedStudents} conectados · {state.readyStudents} listos</span>
      </header>
      {!state.narrativeStarted ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/50">Proyección colectiva</p>
            <h1 className="mt-4 text-3xl font-bold">Esperando al docente</h1>
            <p className="mt-2 text-white/70">{error || 'La experiencia aparecerá aquí cuando inicie.'}</p>
          </div>
        </section>
      ) : introPending ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Introducción en curso</p>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-5xl">Mira la introducción en tu tablet</h1>
            <p className="mt-4 text-lg text-white/75">La narrativa comenzará cuando todas las tablets conectadas terminen el video.</p>
            <p className="mt-6 text-base text-white/60">Completadas: {state.introCompletedStudents}/{state.connectedStudents}</p>
            {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
            <button type="button" onClick={() => void skipIntroduction()} disabled={isSkippingIntro || state.connectedStudents === 0} className="mt-8 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50">{isSkippingIntro ? 'Omitiendo introducción…' : 'Omitir introducción'}</button>
            <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="mt-8 rounded-lg border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{isReturning ? 'Deteniendo narrativa…' : '← Volver a escoger capítulos'}</button>
          </div>
        </section>
      ) : (
        <section className={'mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-8 sm:py-8 ' + (state.stage >= 2 ? 'lg:pl-[24rem]' : '')}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Etapa {state.stage} de 5</p>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{state.stageLabel}</h1>
              <p className="mt-2 max-w-3xl text-base text-white/75 sm:text-lg">{state.stageDescription}</p>
            </div>
            <div className="flex gap-1.5" aria-label={'Etapa ' + state.stage + ' de 5'}>
              {[1, 2, 3, 4, 5].map((step) => <span key={step} className={'h-2 w-8 rounded-full ' + (step <= state.stage ? 'bg-red-500' : 'bg-white/20')} />)}
            </div>
          </div>
          <div className="grid flex-1 place-items-center rounded-2xl bg-gradient-to-br from-[#463535] to-[#231d1d] px-6 py-8 text-center shadow-2xl">
            <div className="max-w-4xl">
              <p className="text-7xl font-black text-red-400 sm:text-9xl">{state.stage}</p>
              <h2 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">{state.stageLabel}</h2>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-white/80 sm:text-2xl">{state.stageDescription}</p>
            </div>
          </div>
          {state.stage === 5 && state.votingOpen && (
            <aside aria-live="polite" aria-label="Resultado agregado de la votación" className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-2xl sm:p-8">
              <h2 className="text-xl font-bold">Votación del grupo</h2>
              <p className="mt-1 text-sm text-gray-600">Resultados anónimos: el grupo recomienda repetir o finalizar; el docente decide.</p>
              {(() => {
                const total = state.continueVotes + state.alternativeVotes
                const repeatPercent = total ? state.continueVotes / total * 100 : 0
                const finishPercent = total ? state.alternativeVotes / total * 100 : 0
                return <>
                  <div className="mt-5 flex justify-between gap-3 text-sm font-semibold"><span className="text-violet-700">Repetir · {state.continueVotes}</span><span className="text-gray-700">Finalizar · {state.alternativeVotes}</span></div>
                  <div className="mt-3 flex h-7 overflow-hidden rounded-full bg-gray-200" role="img" aria-label={`${state.continueVotes} votos para repetir y ${state.alternativeVotes} para finalizar`}>
                    <div className="bg-violet-600 transition-[width] duration-500" style={{ width: `${repeatPercent}%` }} />
                    <div className="bg-gray-500 transition-[width] duration-500" style={{ width: `${finishPercent}%` }} />
                  </div>
                  <p className="mt-3 text-center text-sm text-gray-600">{total} votos recibidos</p>
                </>
              })()}
            </aside>
          )}
          {interactionKind && (
            <aside aria-live="polite" className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-2xl sm:p-8">
              <h2 className="text-xl font-bold">{interactionKind === 'emotion' ? 'Emociones del grupo' : 'Decisiones del grupo'}</h2>
              <p className="mt-1 text-sm text-gray-600">{responseCount} de {state.participantCount} participantes respondieron</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(groupedValues).map(([value, count]) => (
                  <div key={value} className={'rounded-lg border p-3 transition-colors ' + (count === highestCount ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50')}>
                    <div className="mb-2 flex justify-between gap-3 text-sm"><span>{count === highestCount ? '★ ' : ''}{value}{count === highestCount ? ' · Mayoría' : ''}</span><span>{count} ({responseCount ? Math.round(count / responseCount * 100) : 0}%)</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200"><div className={'h-full rounded-full transition-[width] duration-300 ' + (count === highestCount ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${state.participantCount ? count / state.participantCount * 100 : 0}%` }} /></div>
                  </div>
                ))}
                {responseCount === 0 && <p className="text-sm text-gray-600">Esperando respuestas de los estudiantes…</p>}
              </div>
            </aside>
          )}
          {state.stage === 1 && (
            <div className="mx-auto mt-1 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4" aria-label="Controles de la narrativa en las tablets">
              <button type="button" onClick={() => void controlMedia('back-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Atrasar cinco segundos">−5 s</button>
              <button type="button" onClick={() => void controlMedia(state.mediaPaused ? 'play' : 'pause')} disabled={isControllingMedia} className="min-w-40 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700 disabled:opacity-50">{state.mediaPaused ? 'Reanudar' : 'Pausar'}</button>
              <button type="button" onClick={() => void controlMedia('forward-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Adelantar cinco segundos">+5 s</button>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <span aria-hidden="true">{state.volumePercent === 0 ? '🔇' : '🔊'}</span>
                <span className="sr-only">Volumen de la narrativa</span>
                <input type="range" min="0" max="100" value={state.volumePercent} onChange={(event) => controlVolume(Number(event.target.value))} aria-label="Volumen de la narrativa" className="w-24 cursor-pointer accent-red-500" />
                <span className="w-9 text-right tabular-nums">{state.volumePercent}%</span>
              </label>
              <div className="w-full space-y-1 px-1" aria-label="Progreso del video de la narrativa">
                <div role="progressbar" aria-label="Progreso del video" aria-valuemin={0} aria-valuemax={mediaDurationSeconds || undefined} aria-valuenow={Math.min(mediaTime, mediaDurationSeconds || mediaTime)} className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-red-500 transition-[width] duration-300" style={{ width: `${mediaProgress}%` }} />
                </div>
                <div className="flex justify-between text-sm tabular-nums text-white/75" aria-live="polite">
                  <span>{mediaTimeLabel}</span>
                  <span>{mediaDuration > 0 ? mediaDurationLabel : '--:--'}</span>
                </div>
              </div>
            </div>
          )}
          <nav aria-label="Controles de avance de la narrativa" className="mx-auto mt-5 flex w-full max-w-2xl gap-3">
            <button type="button" onClick={() => void changeStage(-1)} disabled={isChangingStage || state.stage <= 1} className="flex-1 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Etapa anterior</button>
            <button type="button" onClick={() => state.stage >= 5 ? void openTeacherFeedback() : void changeStage(1)} disabled={isChangingStage || isOpeningFeedback || (state.stage === 5 && !allReflectionsSubmitted)} className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{isOpeningFeedback ? 'Abriendo votaci\u00f3n\u2026' : state.stage >= 5 ? 'Finalizar Narrativa' : 'Avanzar etapa'}</button>
          </nav>
          {state.stage === 5 && <p className="mt-2 text-center text-xs text-white/70">Reflexiones completas: {completedReflections}/{connectedReflectionParticipants.length}</p>}
          <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="mx-auto mt-4 rounded-lg border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{isReturning ? 'Deteniendo narrativa…' : '← Volver a escoger capítulos'}</button>
          {error && <p role="alert" className="mt-4 text-center text-sm text-amber-200">{error}</p>}
        </section>
      )}
      {state.stage >= 2 && <SupervisionPanel stage={state.stage} students={studentInteractions} />}
    </main>
  )
}
