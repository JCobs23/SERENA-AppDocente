import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '../lib/api'

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
  connectedStudents: number
  readyStudents: number
  introCompletedStudents: number
}
const initialState: ProjectionState = {
  active: true, narrativeStarted: false, stage: 0, stageLabel: 'En espera',
  stageDescription: 'Esperando a que el docente inicie la experiencia.',
  revision: 0, mediaPaused: true, mediaPositionSeconds: 0, mediaRevision: 0, mediaCommand: 'pause',
  connectedStudents: 0, readyStudents: 0, introCompletedStudents: 0,
}

export default function ProjectionScreen({ sessionCode }: { sessionCode: string }) {
  const [state, setState] = useState(initialState)
  const [error, setError] = useState('')
  const [isChangingStage, setIsChangingStage] = useState(false)
  const [isSkippingIntro, setIsSkippingIntro] = useState(false)
  const [isControllingMedia, setIsControllingMedia] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const introPending = state.connectedStudents === 0 || state.introCompletedStudents < state.connectedStudents

  useEffect(() => {
    let active = true
    let retryTimer = 0
    const refresh = async () => {
      try {
        const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode)
        if (active) { setState(next); setError('') }
      } catch {
        if (active) setError('No se pudo conectar con la sesión. Esperando al servidor…')
      } finally {
        if (active) retryTimer = window.setTimeout(() => void refresh(), 700)
      }
    }
    void refresh()
    return () => { active = false; window.clearTimeout(retryTimer) }
  }, [sessionCode])

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
  const mediaTime = Math.max(0, Math.floor(state.mediaPositionSeconds || 0))
  const mediaTimeLabel = `${Math.floor(mediaTime / 60).toString().padStart(2, '0')}:${(mediaTime % 60).toString().padStart(2, '0')}`

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

  return (
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
        <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-8 sm:py-8">
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
          {state.stage === 1 && (
            <div className="mx-auto mt-1 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4" aria-label="Controles de la narrativa en las tablets">
              <button type="button" onClick={() => void controlMedia('back-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Atrasar cinco segundos">−5 s</button>
              <button type="button" onClick={() => void controlMedia(state.mediaPaused ? 'play' : 'pause')} disabled={isControllingMedia} className="min-w-40 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700 disabled:opacity-50">{state.mediaPaused ? 'Reanudar' : 'Pausar'}</button>
              <button type="button" onClick={() => void controlMedia('forward-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Adelantar cinco segundos">+5 s</button>
              <span className="w-full text-center text-sm tabular-nums text-white/70" aria-live="polite">{mediaTimeLabel}</span>
            </div>
          )}
          <nav aria-label="Controles de avance de la narrativa" className="mx-auto mt-5 flex w-full max-w-2xl gap-3">
            <button type="button" onClick={() => void changeStage(-1)} disabled={isChangingStage || state.stage <= 1} className="flex-1 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Etapa anterior</button>
            <button type="button" onClick={() => void changeStage(1)} disabled={isChangingStage || state.stage >= 5} className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Avanzar etapa</button>
          </nav>
          <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="mx-auto mt-4 rounded-lg border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{isReturning ? 'Deteniendo narrativa…' : '← Volver a escoger capítulos'}</button>
          {error && <p role="alert" className="mt-4 text-center text-sm text-amber-200">{error}</p>}
        </section>
      )}
    </main>
  )
}
