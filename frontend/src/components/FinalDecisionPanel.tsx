type AdvanceMode = 'automatic' | 'vote'
type FinalDecisionState = {
  advanceMode: AdvanceMode
  votingOpen: boolean
  continueVotes: number
  alternativeVotes: number
  finalDecision: 'continue' | 'vote' | null
  blockedDecisions?: string[]
}

type Props = {
  state: FinalDecisionState
  busy: boolean
  error: string
  onSelect: (mode: AdvanceMode) => Promise<boolean>
  onFinish: () => void
  onExploreAlternative: () => void
}

function playConfirmationTone(context: AudioContext) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(660, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.17)
  oscillator.onended = () => { void context.close() }
}

export default function FinalDecisionPanel({ state, busy, error, onSelect, onFinish, onExploreAlternative }: Props) {
  const [pendingMode, setPendingMode] = useState<AdvanceMode | null>(null)
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null)

  async function choose(mode: AdvanceMode) {
    setPendingMode(mode)
    setResponseTimeMs(null)
    const startedAt = performance.now()
    let audio: AudioContext | undefined
    try {
      const AudioContextConstructor = window.AudioContext
      if (AudioContextConstructor) {
        audio = new AudioContextConstructor()
        await audio.resume()
      }
    } catch {
      audio = undefined
    }

    const confirmed = await onSelect(mode)
    if (!confirmed) {
      setPendingMode(null)
      if (audio && audio.state !== 'closed') void audio.close()
      return
    }
    setPendingMode(null)
    setResponseTimeMs(Math.round(performance.now() - startedAt))
    if (audio && audio.state === 'running') playConfirmationTone(audio)
  }

  const selectedContinue = pendingMode === 'automatic' || state.finalDecision === 'continue'
  const selectedVote = pendingMode === 'vote' || (state.finalDecision === 'vote' && state.votingOpen)

  return (
    <section aria-labelledby="final-decision-title" className="mx-auto w-full max-w-4xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-600">Story wrap-up</p>
      <h1 id="final-decision-title" className="mt-2 text-3xl font-extrabold text-stone-950">How does the group continue?</h1>
      <p className="mt-2 max-w-2xl text-base text-stone-700">Choose whether the group continues without voting or each student takes part in an anonymous vote.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2" role="group" aria-label="Final story decision">
        <button type="button" onClick={() => void choose('automatic')} disabled={busy} aria-pressed={selectedContinue} className={'min-h-40 rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60 ' + (selectedContinue ? 'border-emerald-700 bg-emerald-50' : 'border-stone-300 bg-white hover:bg-stone-50')}>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-900">→</span>
          <strong className="mt-4 block text-lg">Continue without a vote</strong>
          <span className="mt-1 block text-sm text-stone-700">Ends this story and returns to the catalog to choose the next one.</span>
        </button>
        <button type="button" onClick={() => void choose('vote')} disabled={busy} aria-pressed={selectedVote} className={'min-h-40 rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800 disabled:cursor-wait disabled:opacity-60 ' + (selectedVote ? 'border-rose-700 bg-rose-50' : 'border-stone-300 bg-white hover:bg-stone-50')}>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-900">◎</span>
          <strong className="mt-4 block text-lg">Open a group vote</strong>
          <span className="mt-1 block text-sm text-stone-700">Each student chooses on their tablet how to continue.</span>
        </button>
      </div>

      {selectedContinue && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-950">{pendingMode === 'automatic' ? 'Applying the decision…' : 'Decision confirmed. The session continues without asking the group.'}</p>
          <p className="text-xs text-emerald-800">{pendingMode === 'automatic' ? 'Applying the decision…' : responseTimeMs !== null ? `Response confirmed in ${responseTimeMs} ms` : ''}</p>
          <button type="button" onClick={onFinish} disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 disabled:opacity-60">View group report</button>
        </div>
      )}

      {selectedVote && (
        <div role="status" aria-live="polite" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950">
          <p>{pendingMode === 'vote' ? 'Applying the decision…' : `Votes received: ${state.continueVotes} continue · ${state.alternativeVotes} explore another decision`}</p>
          {responseTimeMs !== null && <span className="text-xs text-rose-800">Response confirmed in {responseTimeMs} ms</span>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onExploreAlternative} disabled={busy} className="rounded-lg border border-rose-800 bg-white px-4 py-2 text-rose-900 hover:bg-rose-100 disabled:opacity-60">Explore an alternative decision</button>
            <button type="button" onClick={onFinish} disabled={busy} className="rounded-lg bg-rose-800 px-4 py-2 text-white hover:bg-rose-900 disabled:opacity-60">End the session and view the report</button>
          </div>
          <p className="basis-full text-xs font-normal text-rose-900">Exploring an alternative takes the group back to stage 3: the most voted option will appear blurred on the tablets and cannot be chosen again.{(state.blockedDecisions?.length ?? 0) > 0 ? ` Already explored: ${state.blockedDecisions!.join(', ')}.` : ''}</p>
        </div>
      )}
      {busy && <p role="status" className="mt-4 text-sm text-stone-600">Saving the decision…</p>}
      {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-800">{error}</p>}
    </section>
  )
}
import { useState } from 'react'

