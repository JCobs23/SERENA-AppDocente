import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeReport, type SessionReport } from '../lib/reports'
import ResultDetailPanel, { type ResultSelection } from './ResultDetailPanel'
import { isSoundEnabled, playSound, setSoundEnabled, startAmbient, stopAmbient } from '../lib/sounds'
import {
  diversityText, generalReflectiveMessages, kindLabels, learningText, neutralLabels, opportunityText,
  reflectionQuestions, reflectiveMessagesByDecision, reflectiveMessagesByEmotion, topicByDecision, topicByEmotion,
  topics, type ResultKind, type Topic,
} from '../lib/summaryTexts'

// Diseño del panel basado en la propuesta del Sprint 4; los datos son agregados
// y anónimos: no se muestran nombres ni identificadores de estudiantes.
// H.U. 11.3.2 (detalle), 11.3.3 (filtros), 11.3.4 (regreso), 11.4.2 (lenguaje neutral),
// 11.5.2 (mensajes para conversar) y 11.5.3 (aprendizajes y oportunidades).
// Edwin: 11.2.2 (sonidos suaves), 11.2.3 (presentación sobria), 11.5.1 (ritmo tranquilo) y
// 11.5.4 (cierre emocionalmente seguro): paleta de saturación media, aparición pausada de los
// bloques, sonidos opcionales a bajo volumen y un mensaje de cierre que no compara ni juzga.

const emotionOptions = [
  { value: 'Confused', color: '#c98f7e' },
  { value: 'Curious', color: '#6f97c4' },
  { value: 'Uncomfortable', color: '#c9a95e' },
  { value: 'Fear of exclusion', color: '#9a8cc4' },
  { value: 'Neutral', color: '#6fb0b4' },
]

const decisionOptions = [
  { value: 'Spread the rumor', color: '#b48a9f', icon: '▣' },
  { value: 'Talk directly', color: '#6fae94', icon: '☷' },
  { value: 'Change the subject', color: '#6f97c4', icon: '⬡' },
  { value: 'Avoid getting involved', color: '#c9a25e', icon: '♧' },
]

type KindFilter = 'all' | ResultKind
type TopicFilter = 'all' | Topic

const normalize = (value: string) => value.trim().toLocaleLowerCase()
// Aparición escalonada de los bloques (H.U. 11.5.1): 150 ms entre uno y otro.
const calm = (order: number) => ({ className: 'serena-calm-in', style: { animationDelay: `${order * 150}ms` } })
const percentOf = (count: number, total: number) => (total ? Math.round(count / total * 100) : 0)

function ordered(values: Record<string, number>, options: { value: string }[]) {
  const known = options.filter((option) => values[option.value]).map((option) => [option.value, values[option.value]] as [string, number])
  const unknown = Object.entries(values).filter(([value, count]) => count > 0 && !options.some((option) => normalize(option.value) === normalize(value)))
  return [...known, ...unknown]
}

function colorFor(value: string, options: { value: string; color: string }[]) {
  return options.find((option) => normalize(option.value) === normalize(value))?.color ?? '#64748b'
}

export default function SessionSummary({ report: rawReport, onFinish, finishLabel = 'Finish and return to the catalog' }: {
  report: SessionReport
  onFinish: () => void
  finishLabel?: string
}) {
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipient, setRecipient] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')
  const [sendFailed, setSendFailed] = useState(false)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all')
  const [selection, setSelection] = useState<ResultSelection | null>(null)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled('summary'))
  const [ambientOn, setAmbientOn] = useState(() => isSoundEnabled('ambient'))
  const savedScroll = useRef(0)
  const lastOpener = useRef<string | null>(null)

  // Los reportes antiguos traen emociones y decisiones en español.
  const report = normalizeReport(rawReport)
  const total = report.participantCount
  const reflections = report.reflections
  const yesAnswers = reflections.reduce((sum, item) => sum + item.yes, 0)
  const answered = reflections.reduce((sum, item) => sum + item.yes + item.no, 0)
  const yesPercent = answered ? percentOf(yesAnswers, answered) : null
  const emotions = ordered(report.emotionCounts, emotionOptions)
  const decisions = ordered(report.decisionCounts, decisionOptions)
  const leadingDecision = decisions.slice().sort((a, b) => b[1] - a[1])[0]
  const leadingEmotion = emotions.slice().sort((a, b) => b[1] - a[1])[0]
  const discomfortCount = (report.emotionCounts['Uncomfortable'] ?? 0) + (report.emotionCounts['Fear of exclusion'] ?? 0)
  const exploredDecisions = report.exploredDecisions ?? []
  const totalVotes = report.continueVotes + report.alternativeVotes
  const continuePercent = percentOf(report.continueVotes, totalVotes)
  const alternativePercent = percentOf(report.alternativeVotes, totalVotes)

  // H.U. 11.3.3: filtros aplicados en el cliente, sin recargar la página.
  const matchesTopic = (topic: Topic | undefined) => topicFilter === 'all' || topic === topicFilter
  const showKind = (kind: ResultKind) => kindFilter === 'all' || kindFilter === kind
  const visibleReflections = showKind('reflection')
    ? reflections.filter((item) => matchesTopic(reflectionQuestions.find((question) => question.question === item.question)?.topic))
    : []
  const visibleEmotions = showKind('emotion') ? emotions.filter(([value]) => matchesTopic(topicByEmotion[value])) : []
  const visibleDecisions = showKind('decision') ? decisions.filter(([value]) => matchesTopic(topicByDecision[value])) : []
  const visibleCount = visibleReflections.length + visibleEmotions.length + visibleDecisions.length
  const filtersActive = kindFilter !== 'all' || topicFilter !== 'all'

  // H.U. 11.5.2: preguntas para conversar según lo que eligió el grupo (sin señalar a nadie).
  const dialogueMessages = [
    ...(leadingDecision ? reflectiveMessagesByDecision[leadingDecision[0]] ?? [] : []),
    ...(leadingEmotion && reflectiveMessagesByEmotion[leadingEmotion[0]] ? [reflectiveMessagesByEmotion[leadingEmotion[0]]] : []),
    ...generalReflectiveMessages,
  ]

  useEffect(() => {
    let cancelled = false
    apiRequest<{ recipients: string[] }>('/reports/recipients')
      .then((result) => {
        if (cancelled) return
        setRecipients(result.recipients)
        setRecipient(result.recipients[0] ?? '')
      })
      .catch(() => { if (!cancelled) setRecipients([]) })
    return () => { cancelled = true }
  }, [])

  // H.U. 11.2.2 y 11.5.4: nota suave al abrir el resumen y ambiente opcional mientras está abierto.
  useEffect(() => {
    playSound('summary-open', 'summary')
  }, [])

  useEffect(() => {
    if (ambientOn) startAmbient()
    else stopAmbient()
    return () => stopAmbient()
  }, [ambientOn])

  function toggleSound() {
    setSoundEnabled('summary', !soundOn)
    setSoundOn(!soundOn)
  }

  function toggleAmbient() {
    setSoundEnabled('ambient', !ambientOn)
    setAmbientOn(!ambientOn)
  }

  function changeKind(kind: KindFilter) {
    if (kind !== kindFilter) playSound('summary-section', 'summary')
    setKindFilter(kind)
  }

  function changeTopic(topic: TopicFilter) {
    if (topic !== topicFilter) playSound('summary-section', 'summary')
    setTopicFilter(topic)
  }

  // H.U. 11.3.4: al regresar se recupera la posición y el foco del resultado abierto.
  useLayoutEffect(() => {
    if (selection) {
      window.scrollTo({ top: 0 })
      return
    }
    window.scrollTo({ top: savedScroll.current })
    if (lastOpener.current)
      document.querySelector<HTMLElement>(`[data-result-key="${CSS.escape(lastOpener.current)}"]`)?.focus({ preventScroll: true })
  }, [selection])

  function openDetail(kind: ResultKind, value: string) {
    savedScroll.current = window.scrollY
    lastOpener.current = `${kind}:${value}`
    playSound('summary-section', 'summary')
    setSelection({ kind, value })
  }

  const closeDetail = useCallback(() => {
    playSound('summary-section', 'summary')
    setSelection(null)
  }, [])

  async function sendReport() {
    if (!recipient || isSending) return
    setIsSending(true)
    setSendMessage('')
    setSendFailed(false)
    try {
      await apiRequest(`/reports/${report.reportId}/send`, {
        method: 'POST',
        body: JSON.stringify({ recipient }),
      })
      setSendMessage(`Report sent to ${recipient} with the subject “Student report”.`)
    } catch {
      setSendFailed(true)
      setSendMessage('The report could not be sent. Check the Gmail SMTP settings and try again.')
    } finally {
      setIsSending(false)
    }
  }

  const header = <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-7">
    <div>
      <h1 className="text-2xl font-extrabold leading-tight sm:text-[26px]">Group data dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">Session {report.sessionCode} · {new Date(report.createdAt).toLocaleString('en-US')} · Emotions, decisions and reflections</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700"><span aria-hidden="true" className="mr-2">♧</span>{total} students</span>
      <button type="button" onClick={toggleSound} aria-pressed={soundOn} title="Soft sounds when changing sections" className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">{soundOn ? '🔈 Sounds' : '🔇 No sounds'}</button>
      <button type="button" onClick={toggleAmbient} aria-pressed={ambientOn} title="Calm background sound while reviewing the summary" className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">{ambientOn ? '♪ Ambient on' : '♪ Ambient off'}</button>
      <button type="button" onClick={onFinish} className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">{finishLabel}</button>
    </div>
  </header>

  if (selection)
    return <main className="min-h-screen bg-[#f5f5f6] text-gray-950">
      {header}
      <div {...calm(0)}><ResultDetailPanel report={report} selection={selection} onBack={closeDetail} /></div>
    </main>

  const detailButtonClass = 'w-full rounded-lg text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return <main className="min-h-screen bg-[#f5f5f6] text-gray-950">
    {header}

    <p role="note" {...calm(0)} className="serena-calm-in mx-5 mt-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 sm:mx-7">{neutralLabels.privacyNote} Select a result to see its detail.</p>

    <section aria-label="Summary filters" {...calm(1)} className="serena-calm-in mx-5 mt-4 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow sm:mx-7">
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Result type</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['all', 'emotion', 'decision', 'reflection'] as KindFilter[]).map((kind) =>
            <button key={kind} type="button" aria-pressed={kindFilter === kind} onClick={() => changeKind(kind)} className={'rounded-full border px-3 py-1.5 text-sm font-semibold ' + (kindFilter === kind ? 'border-stone-700 bg-stone-100 text-stone-900' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')}>{kind === 'all' ? 'All' : kindLabels[kind]}</button>)}
        </div>
      </fieldset>
      <label className="min-w-[220px] text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Topic
        <select value={topicFilter} onChange={(event) => changeTopic(event.target.value as TopicFilter)} className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900">
          <option value="all">All topics</option>
          {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
        </select>
      </label>
      {filtersActive && <button type="button" onClick={() => { playSound('summary-section', 'summary'); setKindFilter('all'); setTopicFilter('all') }} className="text-sm font-semibold text-stone-700 underline-offset-2 hover:underline">Clear filters</button>}
      <p aria-live="polite" className="ml-auto text-sm text-gray-600">{visibleCount} visible results</p>
    </section>

    {visibleCount === 0 && <p role="status" className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-7">{neutralLabels.noResults}</p>}

    <div className="grid gap-5 px-5 py-5 sm:px-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(440px,1fr)]">
      {visibleReflections.length > 0 ? <section {...calm(2)} className="serena-calm-in overflow-hidden rounded-2xl bg-white shadow-lg" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading" className="border-b border-gray-200 px-5 py-4 text-[17px] font-bold">Group reflection</h2>
        <ul className="divide-y divide-gray-100 px-3">
          {visibleReflections.map((item) => {
            const question = reflectionQuestions.find((entry) => entry.question === item.question)
            const itemYes = percentOf(item.yes, total)
            const itemNo = percentOf(item.no, total)
            return <li key={item.question} className="py-2">
              <button type="button" data-result-key={`reflection:${item.question}`} onClick={() => openDetail('reflection', String(item.question))} className={detailButtonClass + ' px-2 py-2'}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{item.question}. {question?.text ?? `Question ${item.question}`}</h3>
                  <span className="text-xs text-gray-600">Yes {item.yes} · No {item.no} · Unanswered {item.unanswered}</span>
                </div>
                <div className="mt-2 flex h-[9px] overflow-hidden rounded-full bg-gray-200" role="img" aria-label={`${itemYes}% yes, ${itemNo}% no`}>
                  <div className="h-full bg-emerald-500" style={{ width: `${itemYes}%` }} />
                  <div className="h-full bg-slate-500" style={{ width: `${itemNo}%` }} />
                </div>
                <span className="mt-1 block text-[11px] font-semibold text-stone-600">{neutralLabels.openDetail} →</span>
              </button>
            </li>
          })}
        </ul>
        <div className="flex gap-4 border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />Yes</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" aria-hidden="true" />No</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />Unanswered</span>
        </div>
      </section> : <div className="hidden xl:block" />}

      <aside className="grid content-start gap-5">
        <section {...calm(3)} className="serena-calm-in rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="statistics-heading">
          <h2 id="statistics-heading" className="mb-3 text-[17px] font-bold"><span className="mr-2 text-stone-500" aria-hidden="true">▥</span>Overall statistics</h2>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <StatCard tone="blue" icon="♙" label="Students" value={`${total}`} detail={`${report.connectedParticipants} connected at the end`} />
            <StatCard tone="green" icon="✎" label={neutralLabels.yesAnswers} value={yesPercent === null ? '—' : `${yesPercent}%`} detail={neutralLabels.yesAnswersDetail(yesAnswers, answered)} />
            <StatCard tone="rose" icon="✓" label="Status" value={report.status === 'completed' ? 'Completed' : 'Partial'} detail={`Stage ${report.stageReached} of 5`} />
          </div>
        </section>

        {visibleEmotions.length > 0 && <section {...calm(4)} className="serena-calm-in rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="emotions-heading">
          <h2 id="emotions-heading" className="mb-3 text-base font-bold">Emotion distribution</h2>
          <ul className="space-y-1">{visibleEmotions.map(([value, count]) => {
            const peak = Math.max(3, ...emotions.map(([, itemCount]) => itemCount))
            return <li key={value}>
              <button type="button" data-result-key={`emotion:${value}`} onClick={() => openDetail('emotion', value)} aria-label={`${value}: ${count} students. ${neutralLabels.openDetail}`} className={detailButtonClass + ' px-2 py-1.5'}>
                <div className="mb-1 flex justify-between gap-3 text-xs"><span>{value}</span><strong className="text-gray-600">{count} ({percentOf(count, total)}%)</strong></div>
                <div className="h-[7px] overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${Math.min(100, count / peak * 100)}%`, backgroundColor: colorFor(value, emotionOptions) }} /></div>
              </button>
            </li>
          })}</ul>
        </section>}
        {showKind('emotion') && emotions.length === 0 && topicFilter === 'all' && <section className="rounded-2xl bg-white p-5 shadow-lg"><h2 className="text-base font-bold">Emotion distribution</h2><p className="py-3 text-sm text-gray-500">No emotions were recorded.</p></section>}

        <section {...calm(5)} className="serena-calm-in rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="learning-heading">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            {showKind('decision') ? <div>
              <h2 id="decisions-heading" className="mb-3 text-base font-bold">Decision distribution</h2>
              <div className="space-y-2">
                {visibleDecisions.length ? visibleDecisions.map(([value, count]) => {
                  const option = decisionOptions.find((item) => normalize(item.value) === normalize(value))
                  const percent = percentOf(count, total)
                  return <button key={value} type="button" data-result-key={`decision:${value}`} onClick={() => openDetail('decision', value)} aria-label={`${value}: ${count} students. ${neutralLabels.openDetail}`} className={detailButtonClass + ' bg-gray-50 px-3 py-2'}>
                    <div className="flex items-center gap-2 text-xs font-medium"><span className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ backgroundColor: option?.color ?? '#64748b' }} aria-hidden="true">{option?.icon ?? '•'}</span><span className="truncate">{value}</span></div>
                    <div className="mt-2 flex items-center gap-2"><div className="h-[7px] flex-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: option?.color ?? '#64748b' }} /></div><strong className="w-14 text-right text-[10px] text-gray-600">{count} ({percent}%)</strong></div>
                  </button>
                }) : <p className="rounded-lg bg-gray-50 px-3 py-4 text-xs text-gray-500">{decisions.length ? 'No decision matches the selected topic.' : 'No decisions were recorded.'}</p>}
              </div>
              {exploredDecisions.length > 0 && <p className="mt-3 text-xs text-gray-600">Most voted in previous rounds: {exploredDecisions.join(', ')}.</p>}
            </div> : <div />}

            <div>
              <h2 id="learning-heading" className="mb-3 text-base font-bold">Learnings and opportunities</h2>
              <h3 className="text-xs font-extrabold">What the group learned</h3>
              <p className="mt-1 text-xs leading-relaxed">{learningText(leadingDecision, total)} {diversityText(decisions.length)}</p>
              <h3 className="mt-4 text-xs font-extrabold">Opportunities for improvement</h3>
              <p className="mt-1 text-xs leading-relaxed">{opportunityText(discomfortCount, total, exploredDecisions)}</p>
            </div>
          </div>
        </section>

        <section {...calm(6)} className="serena-calm-in rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-lg" aria-labelledby="dialogue-heading">
          <h2 id="dialogue-heading" className="text-base font-bold text-emerald-950">To talk about in class</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-950">{dialogueMessages.map((message) => <li key={message}>{message}</li>)}</ul>
        </section>
      </aside>
    </div>

    <section {...calm(7)} className="serena-calm-in mx-5 mb-5 rounded-2xl bg-white px-5 py-8 shadow-lg sm:mx-7 sm:px-10" aria-labelledby="chapter-completed-heading">
      <header className="text-center">
        <h2 id="chapter-completed-heading" className="text-3xl font-extrabold sm:text-4xl">Chapter completed</h2>
        <p className="mt-3 text-base text-gray-600 sm:text-lg">{report.finalDecision
          ? 'The group shared its preference and the teacher made the final decision.'
          : 'The session ended without a recorded final decision.'}</p>
        <p className="mx-auto mt-4 max-w-2xl rounded-xl bg-stone-50 px-5 py-3 text-sm text-stone-700">Thank you for taking part. Every decision is a chance to learn together: there are no right or wrong answers here, and what is shared is treated with respect.</p>
      </header>
      <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2 md:gap-0">
        <div className="flex flex-col items-center px-4 text-center md:border-r md:border-gray-300 md:px-8">
          <p className="text-sm text-gray-500">Group preference</p>
          <h3 className="mt-1 text-lg font-semibold">Continue</h3>
          <p className="mt-1 text-sm text-gray-500">{report.continueVotes} votes · {totalVotes ? `${continuePercent}%` : '—'}</p>
        </div>
        <div className="flex flex-col items-center px-4 text-center md:px-8">
          <p className="text-sm text-gray-500">Group preference</p>
          <h3 className="mt-1 text-lg font-semibold">Explore another decision</h3>
          <p className="mt-1 text-sm text-gray-500">{report.alternativeVotes} votes · {totalVotes ? `${alternativePercent}%` : '—'}</p>
        </div>
      </div>
      <div className="mx-auto mt-7 max-w-5xl" aria-label={`${continuePercent}% voted to continue and ${alternativePercent}% voted to explore another decision`}>
        <div className="relative flex h-12 overflow-hidden rounded-full bg-gray-200 text-sm font-bold text-white">
          <div className="bg-emerald-600/80 transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: `${continuePercent}%` }} />
          <div className="bg-slate-400 transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: `${alternativePercent}%` }} />
          <span className="absolute inset-0 flex items-center justify-center drop-shadow-sm">{totalVotes ? `${continuePercent}% · ${alternativePercent}%` : 'No votes'}</span>
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-gray-600">{totalVotes} votes</p>
      </div>
    </section>

    <section {...calm(8)} className="serena-calm-in mx-5 mb-8 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-white p-5 shadow-lg sm:mx-7" aria-labelledby="send-heading">
      <h2 id="send-heading" className="basis-full text-[17px] font-bold">Share report</h2>
      <div className="min-w-[260px] flex-1"><label htmlFor="report-recipient" className="block text-sm font-bold">Authorized recipient</label>
        <select id="report-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">{recipients.length ? 'Select a recipient' : 'No authorized recipients are configured'}</option>
          {recipients.map((address) => <option key={address} value={address}>{address}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void sendReport()} disabled={!recipient || isSending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">→</span>{isSending ? 'Sending…' : 'Send report'}</button>
        <a href={`/api/reports/${report.reportId}/pdf`} className="inline-flex min-h-11 items-center rounded-lg border border-rose-200 bg-white px-5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">Download PDF</a>
      </div>
      {recipient && <p className="basis-full text-xs text-gray-500">Selected recipient: {recipient} · Subject: Student report</p>}
      {sendMessage && <p role={sendFailed ? 'alert' : 'status'} className={'basis-full text-sm ' + (sendFailed ? 'text-red-700' : 'text-emerald-700')}>{sendMessage}</p>}
    </section>
  </main>
}

const statTones = {
  blue: 'from-blue-50 to-blue-100 text-blue-900',
  green: 'from-emerald-50 to-emerald-100 text-green-900',
  rose: 'from-stone-50 to-stone-100 text-stone-800',
}

function StatCard({ tone, icon, label, value, detail }: { tone: keyof typeof statTones; icon: string; label: string; value: string; detail: string }) {
  return <div className={'relative rounded-2xl bg-gradient-to-r px-4 py-3 ' + statTones[tone]}>
    <span className="absolute right-4 top-3 text-lg opacity-70" aria-hidden="true">{icon}</span>
    <p className="text-xs font-bold">{label}</p>
    <strong className="mt-1 block text-2xl leading-none">{value}</strong>
    <p className="mt-1 text-[11px] opacity-80">{detail}</p>
  </div>
}
