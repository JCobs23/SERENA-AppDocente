import { useEffect, useState } from 'react'
import { apiRequest, ApiError } from '../lib/api'
import SupervisionPanel, { type SupervisionStudent } from './SupervisionPanel'
import FinalDecisionPanel from './FinalDecisionPanel'
import SessionSummary from './SessionSummary'

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
  narrativeStarted: false, stage: 0, stageLabel: 'Waiting',
  stageDescription: 'Waiting for the teacher to start the experience.',
  revision: 0, connectedStudents: 0, readyStudents: 0, introCompletedStudents: 0,
  advanceMode: 'automatic', votingOpen: false, continueVotes: 0, alternativeVotes: 0, finalDecision: null, voteRound: 0,
  emotionCounts: {}, decisionCounts: {},
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
const shortcuts = [
  { key: 'SPACE', description: 'Play or pause the story' },
  { key: '→', description: 'Skip forward 5 seconds' },
  { key: '←', description: 'Skip back 5 seconds' },
  { key: 'M', description: 'Toggle audio' },
  { key: 'F', description: 'Enter full screen' },
  { key: 'ESC', description: 'Exit full screen' },
  { key: '↑ / ↓', description: 'Turn the volume up or down' },
]

function NarrativeControls({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 md:justify-end md:pt-24 md:pr-8">
      <button type="button" aria-label="Close controls menu" onClick={onClose} className="fixed inset-0 cursor-default" />
      <aside id="narrative-controls" role="dialog" aria-modal="true" aria-labelledby="controls-title" className="relative z-10 my-auto w-full max-w-[420px] rounded-2xl bg-[#463535] p-5 text-white shadow-2xl sm:p-6">
        <button type="button" onClick={onClose} aria-label="Close controls" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white/80 hover:bg-white/20">×</button>
        <h2 id="controls-title" className="pr-12 text-xl font-extrabold sm:text-2xl">Story controls</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/75">Keyboard shortcuts for controlling the presentation.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex min-h-[68px] items-center gap-3 rounded-lg bg-white/[0.08] px-3 py-3">
              <kbd className="flex min-h-9 min-w-11 shrink-0 items-center justify-center rounded-md bg-[#723b3e] px-2 text-xs font-bold">{shortcut.key}</kbd>
              <p className="text-sm leading-snug text-white/90">{shortcut.description}</p>
            </div>
          ))}
        </div>
        <footer className="mt-5 rounded-lg border border-[#9b5658] bg-[#542f30] px-3 py-3">
          <p className="text-sm font-bold">Tip</p>
          <p className="mt-1 text-sm text-white/85">Review these controls before starting the presentation.</p>
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
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)

  const [actionError, setActionError] = useState('')
  const connectedStudents = students.filter((student) => student.connected).length
  const readyStudents = students.filter((student) => student.connected && student.ready).length
  const currentInteraction = narrativeState.stage === 2 ? 'emotion' : narrativeState.stage === 5 ? 'reflection' : narrativeState.stage >= 3 ? 'decision' : null
  const isFinalDecision = narrativeState.narrativeStarted && narrativeState.stage === 5
  const activeInteractions = studentInteractions.filter((student) => student.connected)
  const respondedStudents = activeInteractions.filter((student) => currentInteraction && student[currentInteraction]).length
  const reflectionParticipants = activeInteractions.length > 0
    ? activeInteractions
    : studentInteractions
  const completedReflections = reflectionParticipants.filter((student) => {
    const answers = student.reflection?.split(',').map((answer) => answer.trim().toLowerCase()) ?? []
    return answers.length === 4 && answers.every((answer) => answer === 'yes' || answer === 'no')
  }).length
  const allReflectionsSubmitted = reflectionParticipants.length > 0
    && completedReflections === reflectionParticipants.length

  useEffect(() => {
    let disposed = false
    let retryTimer = 0
    let stream: WebSocket | null = null
    void apiRequest<NarrativeState>('/sessions/' + sessionCode)
      .then((state) => {
        if (disposed) return
        setNarrativeState(state)
        if (state.narrativeStarted) window.location.replace('/projection/' + sessionCode)
      })
      .catch(() => { /* La conexiÃ³n en tiempo real conserva la recuperaciÃ³n si la sesiÃ³n tarda en responder. */ })
    const refreshInteractions = async () => {
      try {
        const current = await apiRequest<StudentInteraction[]>('/sessions/' + sessionCode + '/interactions')
        if (!disposed) setStudentInteractions(current)
      } catch { /* Keep the last received data if it cannot be refreshed. */ }
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
      } catch { /* Keep the last valid state. */ }
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
    setIsStarting(true)
    setActionError('')
    try {
      const state = await apiRequest<NarrativeState>('/sessions/' + sessionCode + '/start', {
        method: 'POST',
      })
      setNarrativeState(state)
      window.location.assign('/projection/' + sessionCode)
    } catch (error) {
      setActionError(error instanceof ApiError && error.status === 409
        ? (readyStudents < connectedStudents ? 'Wait until all connected students are ready.' : 'Connect at least one student to start the experience.')
        : 'The story could not be started. Check the server connection and try again.')
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
          ? 'Serena.Api does not have the skip-introduction route enabled. Restart the API; this will clear current sessions.'
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

  async function setAdvanceMode(mode: 'automatic' | 'vote'): Promise<boolean> {
    setIsSettingAdvanceMode(true)
    setActionError('')
    try {
      const state = await apiRequest<NarrativeState>('/sessions/' + sessionCode + '/advance-mode', {
        method: 'POST', body: JSON.stringify({ mode }),
      })
      setNarrativeState(state)
      return true
    } catch {
      setActionError('The decision could not be saved. Check the session connection.')
      return false
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
        ? 'The API did not recognize the stop-story request. Restart Serena.Api and try again.'
        : 'The story could not be stopped. Check the session connection and try again.')
    }
    finally { setIsReturning(false) }
  }


  const connectionCode = sessionCode.match(/.{1,3}/g)?.join(' ') ?? sessionCode

  return (
    isSummaryOpen
      ? <SessionSummary students={studentInteractions} votes={{ continue: narrativeState.continueVotes, alternative: narrativeState.alternativeVotes }} onFinish={returnToChapters} />
      :
    <main className="min-h-screen bg-white px-4 py-5 text-gray-950 sm:px-8">
      <header className="flex items-center justify-between">
        {isFinalDecision ? <span className="text-sm font-bold uppercase tracking-[0.16em] text-stone-600">Serena - Wrap-up</span> : <button type="button" onClick={() => void returnToChapters()} disabled={isReturning} className="text-sm font-medium text-gray-800 hover:text-red-700 disabled:opacity-50">{isReturning ? 'Stopping story...' : 'Back to chapters'}</button>}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onLogout} className="text-sm font-medium text-gray-600 hover:text-red-700">Sign out</button>
          {!isFinalDecision && <button type="button" onClick={() => setIsControlsOpen(true)} aria-label="View keyboard shortcuts" aria-expanded={isControlsOpen} title="View keyboard shortcuts" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 font-bold text-white hover:bg-slate-800">?</button>}
        </div>
      </header>

      {narrativeState.narrativeStarted && !isFinalDecision && (
        <div className="sticky top-2 z-20 mx-auto mt-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Group participation">
            <span><strong>{connectedStudents}</strong> connected</span>
            <span><strong>{respondedStudents}</strong> responded</span>
            <span><strong>{Math.max(0, connectedStudents - respondedStudents)}</strong> pending</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSupervisionOpen((open) => !open)}
            aria-expanded={isSupervisionOpen}
            aria-controls="supervision-panel"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            {isSupervisionOpen ? 'Hide supervision' : 'Open supervision'}
          </button>
        </div>
      )}

      <section className={'mx-auto w-full ' + (isFinalDecision ? 'mt-10 max-w-4xl sm:mt-16' : 'mt-12 max-w-5xl sm:mt-20')}>
        {isFinalDecision ? (
          <FinalDecisionPanel
            state={narrativeState}
            busy={isSettingAdvanceMode || isReturning}
            error={actionError}
            canConfirm={allReflectionsSubmitted}
            completedReflections={completedReflections}
            reflectionsExpected={reflectionParticipants.length}
            onSelect={setAdvanceMode}
            onConfirmFeedback={() => setIsSummaryOpen(true)}
          />
        ) : <>
        <header className="text-center">
          <h1 className="text-4xl font-extrabold text-black">Waiting Room</h1>
          <p className="mt-2 text-base font-medium text-gray-600">Chapter 1: Story 1</p>
          <p className="mt-3 text-sm text-gray-500">{isLive ? 'Live connection active' : 'Reconnecting to the session…'}</p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="min-h-[250px] rounded-2xl border border-gray-100 p-7 shadow-sm">
            <h2 className="text-base font-bold">Session code</h2>
            <p className="mt-8 text-5xl font-black tracking-[0.15em] text-red-600 sm:text-6xl">{connectionCode}</p>
            <p className="mt-3 text-sm text-gray-600">Connected students: {connectedStudents}</p>
            <p className="text-sm text-gray-600">Marked as ready: {readyStudents}</p>
          </section>

          <section className="min-h-[250px] rounded-2xl border border-gray-100 p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Students</h2>
              <span className="text-sm text-gray-500">{connectedStudents}/12 connected</span>
            </div>
            <div className="mt-5 space-y-3">
              {students.length === 0 && <p className="text-sm text-gray-500">Waiting for the first student to connect.</p>}
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={'h-3 w-3 shrink-0 rounded-full ' + (student.connected ? 'bg-emerald-500' : 'bg-red-500')} />
                    <span className="truncate">{student.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{!student.connected ? 'Disconnected' : student.ready ? 'Ready' : 'Connected'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {!narrativeState.narrativeStarted ? (
          <section className="mx-auto mt-7 max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-5">
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
            <button type="button" onClick={() => void startExperience()} disabled={connectedStudents < 1 || readyStudents < connectedStudents || isStarting} className="mt-4 w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isStarting ? 'Starting…' : connectedStudents < 1 ? 'Connect at least one student' : readyStudents < connectedStudents ? 'Waiting for students to be ready (' + readyStudents + '/' + connectedStudents + ')' : 'Start experience'}
            </button>
          </section>
        ) : (
          <section className="mx-auto mt-7 max-w-2xl rounded-xl border border-red-100 bg-red-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Experience in progress</p>
                <h2 className="mt-1 text-lg font-bold">{narrativeState.stage === 0 ? 'Introduction in progress' : (stageTitles[narrativeState.stage] ?? 'Story') + ' - Stage ' + narrativeState.stage + ' of 5'}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">{stageDescriptions[narrativeState.stage] ?? narrativeState.stageDescription}</p>
            {narrativeState.stage < 5 && (
              <fieldset className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-bold text-gray-900">End-of-story voting mode</legend>
                <p className="text-sm text-gray-600">Choose this before the story ends. You can change it during the experience.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void setAdvanceMode('automatic')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.advanceMode === 'automatic'} className={'rounded-lg border px-4 py-3 text-left disabled:opacity-60 ' + (narrativeState.advanceMode === 'automatic' ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600' : 'border-gray-300 bg-white hover:bg-gray-50')}>
                    <strong className="block text-sm">Continue automatically</strong>
                    <span className="mt-1 block text-xs text-gray-600">End the story without asking the group to vote.</span>
                  </button>
                  <button type="button" onClick={() => void setAdvanceMode('vote')} disabled={isSettingAdvanceMode} aria-pressed={narrativeState.advanceMode === 'vote'} className={'rounded-lg border px-4 py-3 text-left disabled:opacity-60 ' + (narrativeState.advanceMode === 'vote' ? 'border-red-600 bg-red-50 ring-2 ring-red-600' : 'border-gray-300 bg-white hover:bg-gray-50')}>
                    <strong className="block text-sm">Group vote</strong>
                    <span className="mt-1 block text-xs text-gray-600">At the end, each student votes from their tablet.</span>
                  </button>
                </div>
              </fieldset>
            )}
            <p className="mt-2 text-sm text-gray-600">Introduction completed on tablets: {narrativeState.introCompletedStudents}/{connectedStudents}</p>
            {narrativeState.stage === 0 && <button type="button" onClick={() => void skipIntroduction()} disabled={isSkippingIntro || connectedStudents === 0} className="mt-4 w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300">{isSkippingIntro ? 'Skipping introduction?' : 'Skip introduction'}</button>}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          </section>
        )}
        {isSupervisionOpen && narrativeState.narrativeStarted && narrativeState.stage >= 2 && (
          <SupervisionPanel
            stage={narrativeState.stage}
            students={studentInteractions}
          />
        )}
        </>}
      </section>
      {isControlsOpen && <NarrativeControls onClose={() => setIsControlsOpen(false)} />}
    </main>
  )
}
