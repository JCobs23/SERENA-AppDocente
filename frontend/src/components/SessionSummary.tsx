import { useState } from 'react'
import type { SupervisionStudent } from './SupervisionPanel'

const emotionOptions = [
  { value: 'Confundido', label: 'Confused', color: '#f54245' },
  { value: 'Curioso', label: 'Curious', color: '#397bf7' },
  { value: 'Incómodo', label: 'Uncomfortable', color: '#efb000' },
  { value: 'Miedo a la exclusión', label: 'Fear', color: '#8958f5' },
  { value: 'Neutral', label: 'Neutral', color: '#08b3c7' },
]

const decisionOptions = [
  { value: 'Difundir el rumor', label: 'Spread the Rumor', color: '#f54245', icon: '▣' },
  { value: 'Dialogar directamente', label: 'Direct Dialogue', color: '#0cb981', icon: '☷' },
  { value: 'Cambiar el tema', label: 'Change the Topic', color: '#397bf7', icon: '⬡' },
  { value: 'Evitar involucrarse', label: 'Avoid Involvement', color: '#ff9900', icon: '♧' },
]

const reflectionQuestions = [
  '¿Esta decisión estuvo de acuerdo con tus valores?',
  '¿Tomarías la misma decisión en la vida real?',
  '¿Pensaste en el impacto sobre las demás personas?',
  '¿Te sientes conforme con este resultado?',
]

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLocaleLowerCase()

function emotionLabel(value: string | null) {
  const option = emotionOptions.find((item) => normalize(item.value) === normalize(value))
  return option?.label ?? value ?? 'No response'
}

function emotionColor(value: string | null) {
  const option = emotionOptions.find((item) => normalize(item.value) === normalize(value))
  return option?.color ?? '#64748b'
}

function decisionLabel(value: string | null) {
  const option = decisionOptions.find((item) => normalize(item.value) === normalize(value))
  return option?.label ?? value ?? 'No response'
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

export default function SessionSummary({ students, votes, onFinish, onRepeat }: { students: SupervisionStudent[]; votes: { continue: number; alternative: number }; onFinish: () => Promise<void>; onRepeat?: () => Promise<void> }) {
  const [selected, setSelected] = useState<SupervisionStudent | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isRepeating, setIsRepeating] = useState(false)
  const [actionError, setActionError] = useState('')
  const participants = students
  const total = participants.length
  const emotionCounts = participants.reduce<Record<string, number>>((result, student) => {
    if (student.emotion) result[student.emotion] = (result[student.emotion] ?? 0) + 1
    return result
  }, {})
  const decisionCounts = participants.reduce<Record<string, number>>((result, student) => {
    if (student.decision) result[student.decision] = (result[student.decision] ?? 0) + 1
    return result
  }, {})
  const reflectionAnswers = participants.flatMap((student) => student.reflection?.split(',').map((answer) => answer.trim().toLowerCase()) ?? [])
  const positive = reflectionAnswers.filter((answer) => answer === 'yes').length
  const answeredReflections = reflectionAnswers.filter((answer) => answer === 'yes' || answer === 'no').length
  const positivePercentage = answeredReflections ? Math.round(positive / answeredReflections * 100) : null
  const totalVotes = votes.continue + votes.alternative
  const repeatPercent = totalVotes ? Math.round(votes.continue / totalVotes * 100) : 0
  const finishPercent = totalVotes ? Math.round(votes.alternative / totalVotes * 100) : 0
  const orderedEmotions = [
    ...emotionOptions.filter((option) => emotionCounts[option.value]).map((option) => [option.value, emotionCounts[option.value]] as [string, number]),
    ...Object.entries(emotionCounts).filter(([value]) => !emotionOptions.some((option) => normalize(option.value) === normalize(value))),
  ]
  const orderedDecisions = [
    ...decisionOptions.filter((option) => decisionCounts[option.value]).map((option) => [option.value, decisionCounts[option.value]] as [string, number]),
    ...Object.entries(decisionCounts).filter(([value]) => !decisionOptions.some((option) => normalize(option.value) === normalize(value))),
  ]
  const leadingDecision = orderedDecisions.slice().sort((a, b) => b[1] - a[1])[0]
  const discomfortCount = participants.filter((student) => {
    const value = normalize(student.emotion)
    return value === normalize('Incómodo') || value === normalize('Miedo a la exclusión')
  }).length
  const decisionPercent = leadingDecision && total ? Math.round(leadingDecision[1] / total * 100) : 0
  const discomfortPercent = total ? Math.round(discomfortCount / total * 100) : 0

  async function finishAndSendReport() {
    setIsFinishing(true)
    setActionError('')
    try { await onFinish() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'The report could not be sent.') }
    finally { setIsFinishing(false) }
  }

  async function repeatExperience() {
    if (!onRepeat) return
    setIsRepeating(true)
    setActionError('')
    try { await onRepeat() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'The experience could not be repeated.') }
    finally { setIsRepeating(false) }
  }

  return <main className="min-h-screen bg-[#f5f5f6] text-gray-950">
    <header className="grid h-auto min-h-[94px] grid-cols-1 items-center gap-3 border-b border-gray-200 bg-white px-5 py-4 shadow-sm sm:grid-cols-[1fr_auto] sm:px-[27px] sm:py-0">
      <div>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-[26px]">Student Data Panel</h1>
        <p className="mt-1 text-sm text-gray-600">A collection of emotions, decisions, and reflections</p>
      </div>
      <div className="justify-self-start rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-red-700 sm:justify-self-center">
        <span aria-hidden="true" className="mr-2">♧</span>{total} Estudiantes
      </div>
    </header>

    <div className="grid gap-5 px-5 py-5 sm:px-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(440px,1fr)]">
      <section className="min-h-[720px] overflow-hidden rounded-2xl bg-white shadow-lg xl:min-h-[870px]" aria-labelledby="registration-heading">
        <h2 id="registration-heading" className="border-b border-gray-200 px-5 py-4 text-[17px] font-bold">Student Registration</h2>
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(130px,.9fr)_minmax(220px,1fr)] bg-[#f4f4f5] px-5 py-2 text-[10px] font-extrabold tracking-[.08em] text-gray-600">
          <span>STUDENTS</span><span>EMOTION</span><span>DECISION</span>
        </div>
        <div className="max-h-[calc(100vh-245px)] min-h-[280px] overflow-y-auto px-5">
          {participants.length === 0 ? <p className="py-8 text-sm text-gray-500">No hay participantes registrados en esta sesión.</p> : participants.map((student) => (
            <div key={student.studentId} className="grid min-h-[61px] grid-cols-[minmax(0,1.5fr)_minmax(130px,.9fr)_minmax(220px,1fr)] items-center border-b border-gray-200 last:border-b-0">
              <div className="flex min-w-0 items-center gap-3 pr-2">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#bd1720] text-xs font-bold text-white">{initials(student.studentName)}</span>
                <span className="truncate text-sm font-medium">{student.studentName}</span>
              </div>
              <div className="pr-2">
                <span className="inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: emotionColor(student.emotion) }}>{emotionLabel(student.emotion)}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-center text-xs text-gray-700">{decisionLabel(student.decision)}</span>
                <button type="button" onClick={() => setSelected(student)} className="shrink-0 rounded-full bg-[#c91822] px-3 py-1 text-xs font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                  <span aria-hidden="true">◉ </span>See
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="grid content-start gap-5">
        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="statistics-heading">
          <h2 id="statistics-heading" className="mb-3 text-[17px] font-bold"><span className="mr-2 text-red-600" aria-hidden="true">▥</span>General Statistics</h2>
          <div className="grid gap-3">
            <div className="relative rounded-2xl bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 text-blue-900">
              <span className="absolute right-4 top-3 text-lg text-blue-600" aria-hidden="true">♙</span>
              <p className="text-xs font-bold">Total Students</p><strong className="mt-1 block text-2xl leading-none">{total}</strong>
            </div>
            <div className="relative rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-100 px-4 py-3 text-green-900">
              <span className="absolute right-4 top-3 text-lg text-green-600" aria-hidden="true">↗</span>
              <p className="text-xs font-bold">Positive Reflections</p><strong className="mt-1 block text-2xl leading-none">{positivePercentage === null ? '—' : `${positivePercentage}%`}</strong>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="emotions-heading">
          <h2 id="emotions-heading" className="mb-3 text-base font-bold">Distribution of Emotions</h2>
          <Distribution rows={orderedEmotions} total={total} label={emotionLabel} color={emotionColor} scaleToPeak />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="decisions-heading">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <h2 id="decisions-heading" className="mb-3 text-base font-bold">Distribution of Decisions</h2>
              <div className="space-y-2">
                {orderedDecisions.length ? orderedDecisions.map(([value, count]) => {
                  const option = decisionOptions.find((item) => normalize(item.value) === normalize(value))
                  const percent = total ? Math.round(count / total * 100) : 0
                  return <div key={value} className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium"><span className="flex h-5 w-5 items-center justify-center rounded bg-white text-white" style={{ backgroundColor: option?.color ?? '#64748b' }}>{option?.icon ?? '•'}</span><span className="truncate">{decisionLabel(value)}</span></div>
                    <div className="mt-2 flex items-center gap-2"><div className="h-[7px] flex-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: option?.color ?? '#64748b' }} /></div><strong className="w-8 text-right text-[10px] text-gray-600">{percent}%</strong></div>
                  </div>
                }) : <p className="rounded-lg bg-gray-50 px-3 py-4 text-xs text-gray-500">No decisions have been recorded.</p>}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-base font-bold">Aprendizajes y Oportunidades</h2>
              <h3 className="text-xs font-extrabold">Aprendizaje del grupo</h3>
              <p className="mt-1 text-xs leading-relaxed">{leadingDecision
                ? `El ${decisionPercent}% del grupo optó por ${decisionLabel(leadingDecision[0])} como respuesta principal${positivePercentage === null ? '.' : `, y el ${positivePercentage}% de las reflexiones fueron positivas.`}`
                : 'Aún no hay decisiones registradas en esta sesión.'}</p>
              <h3 className="mt-4 text-xs font-extrabold">Oportunidades de crecimiento</h3>
              <p className="mt-1 text-xs leading-relaxed">{discomfortCount
                ? `Un ${discomfortPercent}% del grupo mostró emociones como incomodidad o miedo ante el conflicto; puede ser un buen punto de partida para trabajar regulación emocional en la próxima sesión.`
                : 'Aún no se registran emociones de incomodidad o miedo en esta sesión.'}</p>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section className="mx-5 mb-8 rounded-2xl bg-white px-5 py-8 shadow-lg sm:mx-7 sm:px-10" aria-labelledby="chapter-completed-heading">
      <header className="text-center">
        <h2 id="chapter-completed-heading" className="text-3xl font-extrabold sm:text-4xl">Chapter Completed</h2>
        <p className="mt-3 text-base text-gray-600 sm:text-lg">The group has shared its preference. The teacher makes the final decision.</p>
      </header>

      <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2 md:gap-0">
        <div className="flex flex-col items-center px-4 text-center md:border-r md:border-gray-300 md:px-8">
          <p className="text-sm text-gray-500">Student preference</p>
          <h3 className="mt-1 text-lg font-semibold">Finalize the experience</h3>
          <p className="mt-1 text-sm text-gray-500">{votes.alternative} votes · {totalVotes ? `${finishPercent}%` : '—'}</p>
          <button type="button" onClick={() => void finishAndSendReport()} disabled={isFinishing || isRepeating} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60">
            <span aria-hidden="true">→</span>{isFinishing ? 'Sending report…' : 'Finalize and receive report'}
          </button>
        </div>

        <div className="flex flex-col items-center px-4 text-center md:px-8">
          <p className="text-sm text-gray-500">Student preference</p>
          <h3 className="mt-1 text-lg font-semibold">Repeat the experience</h3>
          <p className="mt-1 text-sm text-gray-500">{votes.continue} votes · {totalVotes ? `${repeatPercent}%` : '—'}</p>
          <button type="button" onClick={() => void repeatExperience()} disabled={!onRepeat || isRepeating || isFinishing} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-wait disabled:opacity-60">
            <span aria-hidden="true">↻</span>{isRepeating ? 'Restarting experience…' : 'Repeat experience'}
          </button>
        </div>
      </div>

      <div className="mx-auto mt-7 max-w-5xl" aria-label={`${finishPercent}% voted to finalize and ${repeatPercent}% voted to repeat`}>
        <div className="relative flex h-12 overflow-hidden rounded-full bg-gray-200 text-sm font-bold text-white">
          <div className="flex items-center justify-center bg-emerald-500 transition-[width] duration-500" style={{ width: `${finishPercent}%` }} />
          <div className="flex items-center justify-center bg-red-600 transition-[width] duration-500" style={{ width: `${repeatPercent}%` }} />
          <span className="absolute inset-0 flex items-center justify-center drop-shadow-sm">{totalVotes ? `${finishPercent}% vs ${repeatPercent}%` : 'No votes yet'}</span>
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-gray-600">{totalVotes} votes</p>
      </div>
      {actionError && <p role="alert" className="mx-auto mt-4 max-w-5xl text-center text-sm font-medium text-red-700">{actionError}</p>}
    </section>

    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="student-detail-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gray-950 px-5 py-4 text-white"><div><h2 id="student-detail-title" className="font-bold">{selected.studentName}</h2><p className="text-xs text-white/70">Detalle individual de la sesión</p></div><button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(null)} className="rounded-full bg-white/15 px-3 py-1 text-xl">×</button></header>
        <div className="space-y-4 p-5"><Detail label="Emoción identificada" value={emotionLabel(selected.emotion)} /><Detail label="Decisión tomada" value={decisionLabel(selected.decision)} />
          <div><h3 className="text-xs font-bold uppercase text-gray-500">Respuestas de reflexión</h3>{selected.reflection ? <ul className="mt-2 space-y-2">{selected.reflection.split(',').map((answer, index) => <li key={index} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">{reflectionQuestions[index] ?? `Pregunta ${index + 1}`} <strong className="ml-1">{answer.trim().toLowerCase() === 'yes' ? 'Sí' : answer.trim().toLowerCase() === 'no' ? 'No' : '—'}</strong></li>)}</ul> : <p className="mt-2 text-sm text-gray-500">No respondió las preguntas de reflexión.</p>}</div>
        </div>
      </section>
    </div>}
  </main>
}


function Distribution({ rows, total, label, color, scaleToPeak = false }: { rows: [string, number][]; total: number; label: (value: string) => string; color: (value: string | null) => string; scaleToPeak?: boolean }) {
  if (!rows.length) return <p className="py-3 text-sm text-gray-500">No emotions have been recorded.</p>
  const peak = Math.max(3, ...rows.map(([, count]) => count))
  return <ul className="space-y-1">{rows.map(([value, count]) => {
    const percent = total ? Math.round(count / total * 100) : 0
    const width = scaleToPeak ? Math.min(100, count / peak * 100) : percent
    return <li key={value} className="py-1">
      <div className="mb-1 flex justify-between gap-3 text-xs"><span>{label(value)}</span><strong className="text-gray-600">{count} ({percent}%)</strong></div>
      <div className="h-[7px] overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color(value) }} /></div>
    </li>
  })}</ul>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><h3 className="text-xs font-bold uppercase text-gray-500">{label}</h3><p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm font-semibold">{value || 'Sin respuesta registrada'}</p></div>
}
