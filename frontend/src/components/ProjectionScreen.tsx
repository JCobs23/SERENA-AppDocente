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
  active: true, narrativeStarted: false, stage: 0, stageLabel: 'Waiting',
  stageDescription: 'Waiting for the teacher to start the experience.',
  revision: 0, mediaPaused: true, mediaPositionSeconds: 0, mediaRevision: 0, mediaCommand: 'pause', volumePercent: 70,
  connectedStudents: 0, participantCount: 0, readyStudents: 0, introCompletedStudents: 0, emotionCounts: {}, decisionCounts: {},
  advanceMode: 'automatic', votingOpen: false, continueVotes: 0, alternativeVotes: 0, finalDecision: null, voteRound: 0,
}
const stageTitles = ['Introduction', 'Initial Narrative', 'Recognize the Emotion', 'Choose a Decision', 'See the Consequences', 'Reflect as a Group']
const stageDescriptions = [
  'Watch the introductory video before the story begins.',
  'Observe the situation and understand the context.',
  'Identify the emotion present in this situation.',
  'Consider the alternatives and choose how to act.',
  'Observe how the situation affected everyone involved.',
  'Share a reflection on what happened.',
]
const responseLabels: Record<string, string> = {
  confundido: 'Confused', curioso: 'Curious', inc\u00f3modo: 'Uncomfortable', 'miedo a la exclusi\u00f3n': 'Fear of exclusion', neutral: 'Neutral',
  'difundir el rumor': 'Spread the Rumor', 'dialogar directamente': 'Direct Dialogue', 'cambiar el tema': 'Change the Topic', 'evitar involucrarse': 'Avoid Involvement',
}
function responseLabel(value: string) { return responseLabels[value.trim().toLocaleLowerCase()] ?? value }

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
        if (active) setError('Could not connect to the session. Waiting for the server…')
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
      } catch { /* Keep the latest responses while the connection is restored. */ }
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
      setError('Could not change the stage. Make sure everyone has finished the introduction.')
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
          ? 'The skip-introduction route is not enabled in Serena.Api. Restart the API; this will clear current sessions.'
          : error.status === 409
            ? 'The introduction has already ended or no students are connected.'
            : error.status === 401
              ? 'Your teacher session has expired. Please sign in again.'
              : 'The introduction could not be skipped. Check the connection and try again.'
        : 'The introduction could not be skipped. Check the connection and try again.')
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
          ? 'Your teacher session has expired. Please sign in again.'
          : error.status === 404
            ? 'The API could not find this session. Start a new session from the catalog.'
            : error.status === 409
              ? 'Media controls are only available during Stage 1.'
              : 'The API rejected the media control (HTTP ' + error.status + ').'
        : 'Could not connect to Serena.Api. Check its terminal and try again.')
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
        .catch(() => setError('Could not update the story volume.'))
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
        ? 'The API did not recognize the stop-story request. Restart Serena.Api and try again.'
        : 'The story could not be stopped. Check the session connection and try again.')
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
        setError('Wait for all connected students to complete the four reflections before opening the vote.')
        return
      }
      const next = await apiRequest<ProjectionState>('/sessions/' + sessionCode + '/open-vote', { method: 'POST' })
      setState(next)
      setShowFeedback(true)
    } catch (error) {
      setError(error instanceof ApiError && error.status === 401
        ? 'Your teacher session has expired. Sign in again to view the feedback.'
        : error instanceof ApiError && error.status === 409
          ? 'All connected students must complete the four reflections before opening the vote.'
          : 'Could not load student responses. Check the connection and try again.')
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
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{state.connectedStudents} connected · {state.readyStudents} ready</span>
      </header>
      {!state.narrativeStarted ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/50">Group projection</p>
            <h1 className="mt-4 text-3xl font-bold">Waiting for the teacher</h1>
            <p className="mt-2 text-white/70">{error || 'The experience will appear here once it begins.'}</p>
          </div>
        </section>
      ) : introPending ? (
        <section className="grid flex-1 place-items-center px-6 text-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Introduction in progress</p>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-5xl">Watch the introduction on your tablet</h1>
            <p className="mt-4 text-lg text-white/75">The story will begin when all connected tablets finish the video.</p>
            <p className="mt-6 text-base text-white/60">Completed: {state.introCompletedStudents}/{state.connectedStudents}</p>
            {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
            <button type="button" onClick={() => void skipIntroduction()} disabled={isSkippingIntro || state.connectedStudents === 0} className="mt-8 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50">{isSkippingIntro ? 'Skipping introduction…' : 'Skip introduction'}</button>
            <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="mt-8 rounded-lg border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{isReturning ? 'Stopping story…' : '← Back to chapters'}</button>
          </div>
        </section>
      ) : (
        <section className={'mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-8 sm:py-8 ' + (state.stage >= 2 ? 'lg:pl-[24rem]' : '')}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Stage {state.stage} of 5</p>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{stageTitles[state.stage] ?? state.stageLabel}</h1>
              <p className="mt-2 max-w-3xl text-base text-white/75 sm:text-lg">{stageDescriptions[state.stage] ?? state.stageDescription}</p>
            </div>
            <div className="flex gap-1.5" aria-label={'Stage ' + state.stage + ' of 5'}>
              {[1, 2, 3, 4, 5].map((step) => <span key={step} className={'h-2 w-8 rounded-full ' + (step <= state.stage ? 'bg-red-500' : 'bg-white/20')} />)}
            </div>
          </div>
          <div className="grid flex-1 place-items-center rounded-2xl bg-gradient-to-br from-[#463535] to-[#231d1d] px-6 py-8 text-center shadow-2xl">
            <div className="max-w-4xl">
              <p className="text-7xl font-black text-red-400 sm:text-9xl">{state.stage}</p>
              <h2 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">{stageTitles[state.stage] ?? state.stageLabel}</h2>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-white/80 sm:text-2xl">{stageDescriptions[state.stage] ?? state.stageDescription}</p>
            </div>
          </div>
          {state.stage === 5 && state.votingOpen && (
            <aside aria-live="polite" aria-label="Aggregated vote results" className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-2xl sm:p-8">
              <h2 className="text-xl font-bold">Group vote</h2>
              <p className="mt-1 text-sm text-gray-600">Anonymous results: the group recommends repeating or finishing; the teacher makes the final decision.</p>
              {(() => {
                const total = state.continueVotes + state.alternativeVotes
                const repeatPercent = total ? state.continueVotes / total * 100 : 0
                const finishPercent = total ? state.alternativeVotes / total * 100 : 0
                return <>
                  <div className="mt-5 flex justify-between gap-3 text-sm font-semibold"><span className="text-violet-700">Repeat · {state.continueVotes}</span><span className="text-gray-700">Finish · {state.alternativeVotes}</span></div>
                  <div className="mt-3 flex h-7 overflow-hidden rounded-full bg-gray-200" role="img" aria-label={`${state.continueVotes} votes to repeat and ${state.alternativeVotes} to finish`}>
                    <div className="bg-violet-600 transition-[width] duration-500" style={{ width: `${repeatPercent}%` }} />
                    <div className="bg-gray-500 transition-[width] duration-500" style={{ width: `${finishPercent}%` }} />
                  </div>
                  <p className="mt-3 text-center text-sm text-gray-600">{total} votes received</p>
                </>
              })()}
            </aside>
          )}
          {interactionKind && (
            <aside aria-live="polite" className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-2xl sm:p-8">
              <h2 className="text-xl font-bold">{interactionKind === 'emotion' ? 'Group emotions' : 'Group decisions'}</h2>
              <p className="mt-1 text-sm text-gray-600">{responseCount} of {state.participantCount} participants responded</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(groupedValues).map(([value, count]) => (
                  <div key={value} className={'rounded-lg border p-3 transition-colors ' + (count === highestCount ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50')}>
                    <div className="mb-2 flex justify-between gap-3 text-sm"><span>{count === highestCount ? '* ' : ''}{responseLabel(value)}{count === highestCount ? ' - Majority' : ''}</span><span>{count} ({responseCount ? Math.round(count / responseCount * 100) : 0}%)</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200"><div className={'h-full rounded-full transition-[width] duration-300 ' + (count === highestCount ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${state.participantCount ? count / state.participantCount * 100 : 0}%` }} /></div>
                  </div>
                ))}
                {responseCount === 0 && <p className="text-sm text-gray-600">Waiting for student responses...</p>}
              </div>
            </aside>
          )}
          {state.stage === 1 && (
            <div className="mx-auto mt-1 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4" aria-label="Story controls on student tablets">
              <button type="button" onClick={() => void controlMedia('back-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Go back five seconds">−5 s</button>
              <button type="button" onClick={() => void controlMedia(state.mediaPaused ? 'play' : 'pause')} disabled={isControllingMedia} className="min-w-40 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700 disabled:opacity-50">{state.mediaPaused ? 'Resume' : 'Pause'}</button>
              <button type="button" onClick={() => void controlMedia('forward-5')} disabled={isControllingMedia} className="min-w-20 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:opacity-50" aria-label="Skip ahead five seconds">+5 s</button>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <span aria-hidden="true">{state.volumePercent === 0 ? '🔇' : '🔊'}</span>
                <span className="sr-only">Story volume</span>
                <input type="range" min="0" max="100" value={state.volumePercent} onChange={(event) => controlVolume(Number(event.target.value))} aria-label="Story volume" className="w-24 cursor-pointer accent-red-500" />
                <span className="w-9 text-right tabular-nums">{state.volumePercent}%</span>
              </label>
              <div className="w-full space-y-1 px-1" aria-label="Story video progress">
                <div role="progressbar" aria-label="Video progress" aria-valuemin={0} aria-valuemax={mediaDurationSeconds || undefined} aria-valuenow={Math.min(mediaTime, mediaDurationSeconds || mediaTime)} className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-red-500 transition-[width] duration-300" style={{ width: `${mediaProgress}%` }} />
                </div>
                <div className="flex justify-between text-sm tabular-nums text-white/75" aria-live="polite">
                  <span>{mediaTimeLabel}</span>
                  <span>{mediaDuration > 0 ? mediaDurationLabel : '--:--'}</span>
                </div>
              </div>
            </div>
          )}
          <nav aria-label="Story navigation controls" className="mx-auto mt-5 flex w-full max-w-2xl gap-3">
            <button type="button" onClick={() => void changeStage(-1)} disabled={isChangingStage || state.stage <= 1} className="flex-1 rounded-lg border border-white/25 bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Previous stage</button>
            <button type="button" onClick={() => state.stage >= 5 ? void openTeacherFeedback() : void changeStage(1)} disabled={isChangingStage || isOpeningFeedback || (state.stage === 5 && !allReflectionsSubmitted)} className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{isOpeningFeedback ? 'Opening vote…' : state.stage >= 5 ? 'Finish Story' : 'Advance stage'}</button>
          </nav>
          {state.stage === 5 && <p className="mt-2 text-center text-xs text-white/70">Completed reflections: {completedReflections}/{connectedReflectionParticipants.length}</p>}
          <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="mx-auto mt-4 rounded-lg border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{isReturning ? 'Stopping story…' : '← Back to chapters'}</button>
          {error && <p role="alert" className="mt-4 text-center text-sm text-amber-200">{error}</p>}
        </section>
      )}
      {state.stage >= 2 && <SupervisionPanel stage={state.stage} students={studentInteractions} />}
    </main>
  )
}
