type AdvanceMode = 'automatic' | 'vote'
type FinalDecisionState = {
  advanceMode: AdvanceMode
  votingOpen: boolean
  continueVotes: number
  alternativeVotes: number
  finalDecision: 'continue' | 'vote' | null
}

type Props = {
  state: FinalDecisionState
  busy: boolean
  error: string
  canConfirm: boolean
  completedReflections: number
  reflectionsExpected: number
  onSelect: (mode: AdvanceMode) => Promise<boolean>
  onConfirmFeedback: () => void
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

export default function FinalDecisionPanel({ state, busy, error, canConfirm, completedReflections, reflectionsExpected, onSelect, onConfirmFeedback }: Props) {
  async function choose(mode: AdvanceMode) {
    if (busy || !canConfirm) return
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
      if (audio && audio.state !== 'closed') void audio.close()
      return
    }
    if (audio && audio.state === 'running') playConfirmationTone(audio)
  }

  const selectedContinue = state.finalDecision === 'continue'
  const selectedVote = state.finalDecision === 'vote' && state.votingOpen

  return (
    <section aria-labelledby="final-decision-title" className="mx-auto w-full max-w-4xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-600">Cierre de la narrativa</p>
      <h1 id="final-decision-title" className="mt-2 text-3xl font-extrabold text-stone-950">¿Cómo continúa el grupo?</h1>
      <p className="mt-2 max-w-2xl text-base text-stone-700">Elige si el grupo continúa sin votar o si cada estudiante participa en una votación anónima.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2" role="group" aria-label="Decisión final de la narrativa">
        <button type="button" onClick={() => void choose('automatic')} disabled={busy || !canConfirm} aria-pressed={selectedContinue} className={'min-h-40 rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ' + (selectedContinue ? 'border-emerald-700 bg-emerald-50' : 'border-stone-300 bg-white hover:bg-stone-50')}>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-900">→</span>
          <strong className="mt-4 block text-lg">Continuar sin votación</strong>
          <span className="mt-1 block text-sm text-stone-700">Finaliza esta narrativa y vuelve al catálogo para elegir la siguiente.</span>
        </button>
        <button type="button" onClick={() => void choose('vote')} disabled={busy || !canConfirm} aria-pressed={selectedVote} className={'min-h-40 rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800 disabled:cursor-not-allowed disabled:opacity-50 ' + (selectedVote ? 'border-rose-700 bg-rose-50' : 'border-stone-300 bg-white hover:bg-stone-50')}>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-900">◎</span>
          <strong className="mt-4 block text-lg">Abrir votación grupal</strong>
          <span className="mt-1 block text-sm text-stone-700">Cada estudiante elige desde su tablet cómo continuar.</span>
        </button>
      </div>
      {!canConfirm && <p role="status" aria-live="polite" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        {reflectionsExpected === 0
          ? 'Esperando a que se conecten estudiantes para recibir sus reflexiones.'
          : `Reflexiones completas: ${completedReflections}/${reflectionsExpected}. Podrás confirmar cómo continúa el grupo cuando todos hayan respondido.`}
      </p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="text-sm font-medium text-gray-800">
          {state.finalDecision
            ? 'La decisión está guardada. Abre el resumen de respuestas de esta sesión.'
            : 'Elige cómo continúa el grupo y luego abre el resumen de respuestas.'}
        </p>
        <button
          type="button"
          onClick={onConfirmFeedback}
          disabled={busy || !canConfirm || (!selectedContinue && !selectedVote)}
          className="rounded-lg bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Ver retroalimentación al docente
        </button>
      </div>
      {busy && <p role="status" className="mt-4 text-sm text-stone-600">Guardando la decisión…</p>}
      {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-800">{error}</p>}
    </section>
  )
}
