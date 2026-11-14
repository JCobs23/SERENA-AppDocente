import { useEffect, useRef, useState } from 'react'
import type { AnonymousResponse, SessionReport } from '../lib/reports'
import {
  kindLabels, neutralLabels, reflectionQuestions, reflectiveMessagesByDecision, reflectiveMessagesByEmotion,
  reflectiveMessagesByQuestion, topicByDecision, topicByEmotion, type ResultKind,
} from '../lib/summaryTexts'

// H.U. 11.3.2: información ampliada del resultado elegido. Solo usa respuestas anónimas
// (sin nombre ni identificador) y nunca muestra el orden de llegada de los estudiantes.

export type ResultSelection = { kind: ResultKind; value: string }

const FEW_RESPONSES = 3
const INITIAL_VISIBLE = 8
const percentOf = (count: number, total: number) => (total ? Math.round(count / total * 100) : 0)

function countBy(values: (string | null | undefined)[]) {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function reflectionAnswers(response: AnonymousResponse) {
  const answers = response.reflection?.split(',').map((value) => value.trim()) ?? []
  return answers.length === 4 ? answers : null
}

function Distribution({ title, entries, total, empty }: { title: string; entries: [string, number][]; total: number; empty: string }) {
  return <section className="rounded-xl bg-gray-50 p-4">
    <h3 className="text-sm font-bold">{title}</h3>
    {entries.length ? <ul className="mt-2 space-y-2">{entries.map(([value, count]) =>
      <li key={value}>
        <div className="flex justify-between gap-3 text-xs"><span>{value}</span><strong className="text-gray-600">{count} ({percentOf(count, total)}%)</strong></div>
        <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-slate-500" style={{ width: `${percentOf(count, total)}%` }} /></div>
      </li>)}</ul> : <p className="mt-2 text-xs text-gray-500">{empty}</p>}
  </section>
}

function ReflectionBreakdown({ responses }: { responses: AnonymousResponse[] }) {
  const answered = responses.map(reflectionAnswers).filter((value): value is string[] => value !== null)
  return <section className="rounded-xl bg-gray-50 p-4">
    <h3 className="text-sm font-bold">Reflection in these responses</h3>
    {answered.length ? <ul className="mt-2 space-y-2">{reflectionQuestions.map((item, index) => {
      const yes = answered.filter((answers) => answers[index] === 'yes').length
      const no = answered.length - yes
      return <li key={item.question} className="text-xs">
        <p>{item.question}. {item.text}</p>
        <p className="text-gray-600">Yes {yes} · No {no}</p>
      </li>
    })}</ul> : <p className="mt-2 text-xs text-gray-500">These responses do not include a submitted reflection.</p>}
  </section>
}

export default function ResultDetailPanel({ report, selection, onBack }: {
  report: SessionReport
  selection: ResultSelection
  onBack: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const backButton = useRef<HTMLButtonElement>(null)
  const total = report.participantCount
  const responses = report.responses ?? null
  const question = selection.kind === 'reflection' ? reflectionQuestions.find((item) => String(item.question) === selection.value) : undefined
  const questionIndex = question ? question.question - 1 : -1

  useEffect(() => { backButton.current?.focus() }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onBack() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])

  const title = selection.kind === 'reflection' ? `${question?.question}. ${question?.text}` : selection.value
  const topic = selection.kind === 'emotion' ? topicByEmotion[selection.value]
    : selection.kind === 'decision' ? topicByDecision[selection.value] : question?.topic

  const subset = responses?.filter((response) => selection.kind === 'emotion' ? response.emotion === selection.value
    : selection.kind === 'decision' ? response.decision === selection.value
      : reflectionAnswers(response) !== null) ?? []
  const aggregateCount = selection.kind === 'emotion' ? report.emotionCounts[selection.value] ?? 0
    : selection.kind === 'decision' ? report.decisionCounts[selection.value] ?? 0
      : (report.reflections.find((item) => item.question === question?.question)?.yes ?? 0)
        + (report.reflections.find((item) => item.question === question?.question)?.no ?? 0)

  const messages = selection.kind === 'decision' ? reflectiveMessagesByDecision[selection.value] ?? []
    : selection.kind === 'emotion' ? [reflectiveMessagesByEmotion[selection.value]].filter(Boolean)
      : [reflectiveMessagesByQuestion[question?.question ?? 0]].filter(Boolean)

  const visible = showAll ? subset : subset.slice(0, INITIAL_VISIBLE)

  return <section aria-labelledby="detail-heading" className="mx-5 my-5 rounded-2xl bg-white p-5 shadow-lg sm:mx-7 sm:p-7">
    <button ref={backButton} type="button" onClick={onBack} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700">← {neutralLabels.backToSummary}</button>

    <header className="mt-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{kindLabels[selection.kind]}{topic ? ` · ${topic}` : ''}</p>
      <h2 id="detail-heading" className="mt-1 text-2xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{aggregateCount} of {total} students ({percentOf(aggregateCount, total)}%){selection.kind === 'reflection' ? ' answered this question' : ''}</p>
    </header>

    {responses === null ? <p role="note" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{neutralLabels.oldReport}</p>
      : aggregateCount === 0 ? <p className="mt-5 text-sm text-gray-600">{neutralLabels.noResponsesForResult}</p>
        : <>
          {subset.length < FEW_RESPONSES && <p role="note" className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">{neutralLabels.fewResponses}</p>}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selection.kind === 'decision' && <>
              <Distribution title="Emotions of those who chose this option" entries={countBy(subset.map((item) => item.emotion))} total={subset.length} empty="No emotions recorded." />
              <ReflectionBreakdown responses={subset} />
            </>}
            {selection.kind === 'emotion' && <>
              <Distribution title="Decisions of those who felt this emotion" entries={countBy(subset.map((item) => item.decision))} total={subset.length} empty="No decisions recorded." />
              <ReflectionBreakdown responses={subset} />
            </>}
            {selection.kind === 'reflection' && <>
              <Distribution title="Decisions of those who answered “yes”" entries={countBy(subset.filter((item) => reflectionAnswers(item)?.[questionIndex] === 'yes').map((item) => item.decision))} total={subset.length} empty="Nobody answered “yes”." />
              <Distribution title="Decisions of those who answered “no”" entries={countBy(subset.filter((item) => reflectionAnswers(item)?.[questionIndex] === 'no').map((item) => item.decision))} total={subset.length} empty="Nobody answered “no”." />
            </>}
          </div>

          <section className="mt-6" aria-labelledby="responses-heading">
            <h3 id="responses-heading" className="text-base font-bold">Group responses ({subset.length})</h3>
            <p className="text-xs text-gray-500">Sorted by content, without names or arrival order.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{visible.map((response, index) => {
              const answers = reflectionAnswers(response)
              return <li key={index} className="rounded-xl border border-gray-200 px-3 py-2 text-xs">
                <p><span className="font-semibold">Emotion:</span> {response.emotion ?? '—'}</p>
                <p><span className="font-semibold">Decision:</span> {response.decision ?? '—'}</p>
                <p><span className="font-semibold">Reflection:</span> {answers ? answers.map((answer) => answer === 'yes' ? 'Yes' : 'No').join(' · ') : 'Not submitted'}</p>
              </li>
            })}</ul>
            {subset.length > INITIAL_VISIBLE && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-sm font-semibold text-stone-700 hover:underline">{showAll ? 'Show less' : `Show all (${subset.length})`}</button>}
          </section>
        </>}

    {messages.length > 0 && <section className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4" aria-labelledby="detail-dialogue-heading">
      <h3 id="detail-dialogue-heading" className="text-sm font-bold text-emerald-950">To talk about in class</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-950">{messages.map((message) => <li key={message}>{message}</li>)}</ul>
    </section>}

    <button type="button" onClick={onBack} className="mt-6 rounded-lg bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-900">{neutralLabels.backToSummary}</button>
  </section>
}
