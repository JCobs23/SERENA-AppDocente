import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'

type ProjectionState = {
  narrativeStarted: boolean
  stage: number
  stageLabel: string
  stageDescription: string
  revision: number
  connectedStudents: number
  readyStudents: number
  introCompletedStudents: number
  isPaused: boolean
  elapsedSeconds: number
  volumePercent: number
}
const initialState: ProjectionState = {
  narrativeStarted: false, stage: 0, stageLabel: 'En espera',
  stageDescription: 'Esperando a que el docente inicie la experiencia.',
  revision: 0, connectedStudents: 0, readyStudents: 0, introCompletedStudents: 0,
  isPaused: false, elapsedSeconds: 0, volumePercent: 70,
}
const durationSeconds = 10 * 60

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export default function ProjectionScreen({ sessionCode }: { sessionCode: string }) {
  const [state, setState] = useState(initialState)
  const [error, setError] = useState('')
  const [isChangingStage, setIsChangingStage] = useState(false)
  const [isChangingPlayback, setIsChangingPlayback] = useState(false)
  const volumeTimer = useRef<number | undefined>(undefined)
  const [stateReceivedAt, setStateReceivedAt] = useState(Date.now())
  const [volume, setVolume] = useState(() => {
    const saved = Number(window.localStorage.getItem('serena-projection-volume'))
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 70
  })
  const [clock, setClock] = useState(Date.now())
  const introPending = state.connectedStudents === 0 || state.introCompletedStudents < state.connectedStudents
  const elapsed = Math.min(durationSeconds, state.elapsedSeconds + (!state.isPaused ? Math.max(0, Math.floor((clock - stateReceivedAt) / 1000)) : 0))

  useEffect(() => {
    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => { media.volume = volume / 100 })
  }, [volume])

  useEffect(() => {
    let active = true
    let retryTimer = 0
    const refresh = async () => {
      try {
        const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode)
        if (active) {
          setState(next)
          setStateReceivedAt(Date.now())
          if (volumeTimer.current === undefined) setVolume(next.volumePercent)
          setError('')
        }
      } catch {
        if (active) setError('No se pudo conectar con la sesión. Esperando al servidor…')
      } finally {
        if (active) retryTimer = window.setTimeout(() => void refresh(), 700)
      }
    }
    void refresh()
    const interval = window.setInterval(() => setClock(Date.now()), 1000)
    return () => {
      active = false
      window.clearTimeout(retryTimer)
      window.clearInterval(interval)
      window.clearTimeout(volumeTimer.current)
    }
  }, [sessionCode])

  async function changeStage(direction: -1 | 1) {
    setIsChangingStage(true)
    setError('')
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/stage', {
        method: 'POST', body: JSON.stringify({ direction }),
      })
      setState(next)
      setStateReceivedAt(Date.now())
    } catch {
      setError('No se pudo cambiar la etapa. Verifica que todos hayan terminado la introducción.')
    } finally { setIsChangingStage(false) }
  }

  async function togglePlayback() {
    if (isChangingPlayback) return
    setIsChangingPlayback(true)
    setError('')
    try {
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/playback', {
        method: 'POST', body: JSON.stringify({ paused: !state.isPaused }),
      })
      setState(next)
      setStateReceivedAt(Date.now())
    } catch {
      setError('No se pudo actualizar la reproducción. Revisa la conexión con el servidor.')
    } finally { setIsChangingPlayback(false) }
  }

  function updateVolume(value: number) {
    setVolume(value)
    window.localStorage.setItem('serena-projection-volume', String(value))
    window.clearTimeout(volumeTimer.current)
    volumeTimer.current = window.setTimeout(() => {
      void apiRequest<ProjectionState>('/sessions/' + sessionCode + '/volume', {
        method: 'POST', body: JSON.stringify({ volumePercent: value }),
      }).then((next) => {
        setState(next)
        setStateReceivedAt(Date.now())
      }).catch(() => setError('No se pudo actualizar el volumen para la sesión.'))
        .finally(() => { volumeTimer.current = undefined })
    }, 180)
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#171717] text-white">
      <header className="absolute z-10 flex w-full items-start justify-between px-5 py-4 sm:px-8">
        <div className="drop-shadow-lg">
          <p className="text-xs text-white/65">Capítulo 1</p>
          <h1 className="mt-1 text-sm font-extrabold sm:text-base">Example Narrative 1</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs shadow">♟ {state.connectedStudents} conectados</span>
          <button type="button" onClick={() => window.close()} aria-label="Cerrar proyección" className="grid h-8 w-8 place-items-center rounded-full bg-black/35 text-lg hover:bg-black/55">×</button>
        </div>
      </header>

      {!state.narrativeStarted ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/50">Proyección colectiva</p>
            <h2 className="mt-4 text-3xl font-bold">Esperando al docente</h2>
            <p className="mt-2 text-white/70">{error || 'La experiencia aparecerá aquí cuando inicie.'}</p>
          </div>
        </section>
      ) : introPending ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Introducción en curso</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-5xl">Mira la introducción en tu tablet</h2>
            <p className="mt-4 text-lg text-white/75">La narrativa comenzará cuando todas las tablets conectadas terminen el video.</p>
            <p className="mt-6 text-base text-white/60">Completadas: {state.introCompletedStudents}/{state.connectedStudents}</p>
            {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
          </div>
        </section>
      ) : (
        <section className="relative flex min-h-screen flex-1 flex-col justify-center overflow-hidden bg-[#27211e]">
          <div className="absolute inset-0 bg-[url('/ImagenesCapitulos/Capitulo%201/cover%20-%20copia.png')] bg-cover bg-center opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/25 to-black/80" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-32 pt-24 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200 drop-shadow">Etapa {state.stage} de 5</p>
            <h2 className="mt-3 text-3xl font-black drop-shadow-lg sm:text-5xl">{state.stageLabel}</h2>
            <p className="mt-4 max-w-3xl text-base text-white/90 drop-shadow sm:text-xl">{state.stageDescription}</p>
            {state.isPaused && <p role="status" className="mt-6 rounded-full bg-black/45 px-4 py-2 text-sm font-bold tracking-wide">Actividad en pausa</p>}
            <button type="button" onClick={() => void togglePlayback()} disabled={isChangingPlayback} aria-label={state.isPaused ? 'Reanudar actividad' : 'Pausar actividad'} className="mt-8 grid h-16 w-16 place-items-center rounded-full bg-red-600 text-2xl shadow-xl transition hover:scale-105 hover:bg-red-700 disabled:opacity-60 sm:h-20 sm:w-20">
              {state.isPaused ? <span className="ml-1 border-y-[12px] border-l-[19px] border-y-transparent border-l-white" /> : <span className="flex gap-1.5"><i className="h-6 w-2 rounded-sm bg-white" /><i className="h-6 w-2 rounded-sm bg-white" /></span>}
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-5 pt-12 sm:px-8">
            <label className="group relative block h-1 cursor-pointer rounded-full bg-white/30" aria-label="Tiempo transcurrido de la actividad">
              <span className="absolute left-0 top-0 h-full rounded-full bg-red-600" style={{ width: `${Math.min(100, elapsed / durationSeconds * 100)}%` }} />
              <input type="range" min="0" max={durationSeconds} value={elapsed} readOnly aria-label="Progreso de la actividad" className="absolute inset-0 h-1 w-full cursor-default opacity-0" />
            </label>
            <div className="mt-3 flex items-center gap-3 sm:gap-5">
              <button type="button" onClick={() => void togglePlayback()} disabled={isChangingPlayback} aria-label={state.isPaused ? 'Reanudar actividad' : 'Pausar actividad'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm text-black hover:bg-white/85">
                {state.isPaused ? <span className="ml-0.5 border-y-[6px] border-l-[9px] border-y-transparent border-l-black" /> : <span className="flex gap-0.5"><i className="h-3.5 w-1 rounded-sm bg-black" /><i className="h-3.5 w-1 rounded-sm bg-black" /></span>}
              </button>
              <span className="text-[11px] tabular-nums text-white/85">{formatTime(elapsed)} / {formatTime(durationSeconds)}</span>
              <div className="ml-auto flex items-center gap-2">
                <span aria-hidden="true" className="text-base">{volume === 0 ? '◖' : '◖))'}</span>
                <input type="range" min="0" max="100" value={volume} onChange={(event) => updateVolume(Number(event.target.value))} aria-label="Volumen de la proyección" className="h-1 w-20 cursor-pointer accent-white sm:w-28" />
                <span className="hidden text-xs tabular-nums text-white/70 sm:inline">{volume}%</span>
              </div>
            </div>
            {error && <p role="alert" className="mt-3 text-center text-sm text-amber-200">{error}</p>}
            <nav aria-label="Controles de avance de la narrativa" className="mx-auto mt-4 flex w-full max-w-2xl gap-3">
              <button type="button" onClick={() => void changeStage(-1)} disabled={isChangingStage || state.stage <= 1 || state.isPaused} className="flex-1 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Etapa anterior</button>
              <button type="button" onClick={() => void changeStage(1)} disabled={isChangingStage || state.stage >= 5 || state.isPaused} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Avanzar etapa</button>
            </nav>
          </div>
        </section>
      )}
    </main>
  )
}
