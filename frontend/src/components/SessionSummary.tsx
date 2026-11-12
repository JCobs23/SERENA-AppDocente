import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import type { SessionReport } from '../lib/reports'

// Diseño del panel basado en la propuesta del Sprint 4; los datos son agregados
// y anónimos: no se muestran nombres ni identificadores de estudiantes.

const emotionOptions = [
  { value: 'Confundido', color: '#f54245' },
  { value: 'Curioso', color: '#397bf7' },
  { value: 'Incómodo', color: '#efb000' },
  { value: 'Miedo a la exclusión', color: '#8958f5' },
  { value: 'Neutral', color: '#08b3c7' },
]

const decisionOptions = [
  { value: 'Difundir el rumor', color: '#f54245', icon: '▣' },
  { value: 'Dialogar directamente', color: '#0cb981', icon: '☷' },
  { value: 'Cambiar el tema', color: '#397bf7', icon: '⬡' },
  { value: 'Evitar involucrarse', color: '#ff9900', icon: '♧' },
]

const reflectionQuestions = [
  '¿Esta decisión estuvo de acuerdo con tus valores?',
  '¿Tomarías la misma decisión en la vida real?',
  '¿Pensaste en el impacto sobre las demás personas?',
  '¿Te sientes conforme con este resultado?',
]

const normalize = (value: string) => value.trim().toLocaleLowerCase()
const percentOf = (count: number, total: number) => (total ? Math.round(count / total * 100) : 0)

function ordered(values: Record<string, number>, options: { value: string }[]) {
  const known = options.filter((option) => values[option.value]).map((option) => [option.value, values[option.value]] as [string, number])
  const unknown = Object.entries(values).filter(([value, count]) => count > 0 && !options.some((option) => normalize(option.value) === normalize(value)))
  return [...known, ...unknown]
}

function colorFor(value: string, options: { value: string; color: string }[]) {
  return options.find((option) => normalize(option.value) === normalize(value))?.color ?? '#64748b'
}

export default function SessionSummary({ report, onFinish, finishLabel = 'Finalizar y volver al catálogo' }: {
  report: SessionReport
  onFinish: () => void
  finishLabel?: string
}) {
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipient, setRecipient] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')
  const [sendFailed, setSendFailed] = useState(false)

  const total = report.participantCount
  const reflections = report.reflections
  const positive = reflections.reduce((sum, item) => sum + item.yes, 0)
  const answered = reflections.reduce((sum, item) => sum + item.yes + item.no, 0)
  const positivePercent = answered ? percentOf(positive, answered) : null
  const emotions = ordered(report.emotionCounts, emotionOptions)
  const decisions = ordered(report.decisionCounts, decisionOptions)
  const leadingDecision = decisions.slice().sort((a, b) => b[1] - a[1])[0]
  const discomfortCount = (report.emotionCounts['Incómodo'] ?? 0) + (report.emotionCounts['Miedo a la exclusión'] ?? 0)
  const totalVotes = report.continueVotes + report.alternativeVotes
  const continuePercent = percentOf(report.continueVotes, totalVotes)
  const alternativePercent = percentOf(report.alternativeVotes, totalVotes)

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
      setSendMessage(`Informe enviado a ${recipient} con el asunto «Informe estudiantes».`)
    } catch {
      setSendFailed(true)
      setSendMessage('No se pudo enviar. Revisa la configuración SMTP de Gmail y vuelve a intentarlo.')
    } finally {
      setIsSending(false)
    }
  }

  return <main className="min-h-screen bg-[#f5f5f6] text-gray-950">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-7">
      <div>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-[26px]">Panel de datos del grupo</h1>
        <p className="mt-1 text-sm text-gray-600">Sesión {report.sessionCode} · {new Date(report.createdAt).toLocaleString()} · Emociones, decisiones y reflexiones</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-red-700"><span aria-hidden="true" className="mr-2">♧</span>{total} estudiantes</span>
        <button type="button" onClick={onFinish} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{finishLabel}</button>
      </div>
    </header>

    <p role="note" className="mx-5 mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:mx-7">Este reporte contiene resultados agregados del grupo. No incluye nombres ni identificadores de estudiantes.</p>

    <div className="grid gap-5 px-5 py-5 sm:px-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(440px,1fr)]">
      <section className="overflow-hidden rounded-2xl bg-white shadow-lg" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading" className="border-b border-gray-200 px-5 py-4 text-[17px] font-bold">Reflexión del grupo</h2>
        <ul className="divide-y divide-gray-100 px-5">
          {reflections.map((item) => {
            const yesPercent = percentOf(item.yes, total)
            const noPercent = percentOf(item.no, total)
            return <li key={item.question} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{item.question}. {reflectionQuestions[item.question - 1] ?? `Pregunta ${item.question}`}</h3>
                <span className="text-xs text-gray-600">Sí {item.yes} · No {item.no} · Sin respuesta {item.unanswered}</span>
              </div>
              <div className="mt-2 flex h-[9px] overflow-hidden rounded-full bg-gray-200" role="img" aria-label={`${yesPercent}% sí, ${noPercent}% no`}>
                <div className="h-full bg-emerald-500" style={{ width: `${yesPercent}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${noPercent}%` }} />
              </div>
            </li>
          })}
        </ul>
        <div className="flex gap-4 border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />Sí</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />No</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />Sin respuesta</span>
        </div>
      </section>

      <aside className="grid content-start gap-5">
        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="statistics-heading">
          <h2 id="statistics-heading" className="mb-3 text-[17px] font-bold"><span className="mr-2 text-red-600" aria-hidden="true">▥</span>Estadísticas generales</h2>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <StatCard tone="blue" icon="♙" label="Estudiantes" value={`${total}`} detail={`${report.connectedParticipants} conectados al cierre`} />
            <StatCard tone="green" icon="↗" label="Reflexiones positivas" value={positivePercent === null ? '—' : `${positivePercent}%`} detail={`${positive} de ${answered} respuestas`} />
            <StatCard tone="rose" icon="✓" label="Estado" value={report.status === 'completed' ? 'Completada' : 'Parcial'} detail={`Etapa ${report.stageReached} de 5`} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="emotions-heading">
          <h2 id="emotions-heading" className="mb-3 text-base font-bold">Distribución de emociones</h2>
          {emotions.length ? <ul className="space-y-1">{emotions.map(([value, count]) => {
            const peak = Math.max(3, ...emotions.map(([, itemCount]) => itemCount))
            return <li key={value} className="py-1">
              <div className="mb-1 flex justify-between gap-3 text-xs"><span>{value}</span><strong className="text-gray-600">{count} ({percentOf(count, total)}%)</strong></div>
              <div className="h-[7px] overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${Math.min(100, count / peak * 100)}%`, backgroundColor: colorFor(value, emotionOptions) }} /></div>
            </li>
          })}</ul> : <p className="py-3 text-sm text-gray-500">No se registraron emociones.</p>}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-lg" aria-labelledby="decisions-heading">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <h2 id="decisions-heading" className="mb-3 text-base font-bold">Distribución de decisiones</h2>
              <div className="space-y-2">
                {decisions.length ? decisions.map(([value, count]) => {
                  const option = decisionOptions.find((item) => normalize(item.value) === normalize(value))
                  const percent = percentOf(count, total)
                  return <div key={value} className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium"><span className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ backgroundColor: option?.color ?? '#64748b' }} aria-hidden="true">{option?.icon ?? '•'}</span><span className="truncate">{value}</span></div>
                    <div className="mt-2 flex items-center gap-2"><div className="h-[7px] flex-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: option?.color ?? '#64748b' }} /></div><strong className="w-14 text-right text-[10px] text-gray-600">{count} ({percent}%)</strong></div>
                  </div>
                }) : <p className="rounded-lg bg-gray-50 px-3 py-4 text-xs text-gray-500">No se registraron decisiones.</p>}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-base font-bold">Aprendizajes y oportunidades</h2>
              <h3 className="text-xs font-extrabold">Aprendizaje del grupo</h3>
              <p className="mt-1 text-xs leading-relaxed">{leadingDecision
                ? `El ${percentOf(leadingDecision[1], total)}% del grupo optó por «${leadingDecision[0]}» como respuesta principal${positivePercent === null ? '.' : `, y el ${positivePercent}% de las reflexiones fueron positivas.`}`
                : 'Aún no hay decisiones registradas en esta sesión.'}</p>
              <h3 className="mt-4 text-xs font-extrabold">Oportunidades de crecimiento</h3>
              <p className="mt-1 text-xs leading-relaxed">{discomfortCount
                ? `Un ${percentOf(discomfortCount, total)}% del grupo mostró emociones como incomodidad o miedo ante el conflicto; puede ser un buen punto de partida para trabajar regulación emocional en la próxima sesión.`
                : 'No se registraron emociones de incomodidad o miedo en esta sesión.'}</p>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section className="mx-5 mb-5 rounded-2xl bg-white px-5 py-8 shadow-lg sm:mx-7 sm:px-10" aria-labelledby="chapter-completed-heading">
      <header className="text-center">
        <h2 id="chapter-completed-heading" className="text-3xl font-extrabold sm:text-4xl">Capítulo completado</h2>
        <p className="mt-3 text-base text-gray-600 sm:text-lg">{report.finalDecision
          ? 'El grupo compartió su preferencia y el docente tomó la decisión final.'
          : 'La sesión terminó sin una decisión final registrada.'}</p>
      </header>
      <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2 md:gap-0">
        <div className="flex flex-col items-center px-4 text-center md:border-r md:border-gray-300 md:px-8">
          <p className="text-sm text-gray-500">Preferencia del grupo</p>
          <h3 className="mt-1 text-lg font-semibold">Continuar</h3>
          <p className="mt-1 text-sm text-gray-500">{report.continueVotes} votos · {totalVotes ? `${continuePercent}%` : '—'}</p>
        </div>
        <div className="flex flex-col items-center px-4 text-center md:px-8">
          <p className="text-sm text-gray-500">Preferencia del grupo</p>
          <h3 className="mt-1 text-lg font-semibold">Explorar otra decisión</h3>
          <p className="mt-1 text-sm text-gray-500">{report.alternativeVotes} votos · {totalVotes ? `${alternativePercent}%` : '—'}</p>
        </div>
      </div>
      <div className="mx-auto mt-7 max-w-5xl" aria-label={`${continuePercent}% votó continuar y ${alternativePercent}% votó explorar otra decisión`}>
        <div className="relative flex h-12 overflow-hidden rounded-full bg-gray-200 text-sm font-bold text-white">
          <div className="bg-emerald-500 transition-[width] duration-500" style={{ width: `${continuePercent}%` }} />
          <div className="bg-red-600 transition-[width] duration-500" style={{ width: `${alternativePercent}%` }} />
          <span className="absolute inset-0 flex items-center justify-center drop-shadow-sm">{totalVotes ? `${continuePercent}% vs ${alternativePercent}%` : 'Sin votos'}</span>
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-gray-600">{totalVotes} votos</p>
      </div>
    </section>

    <section className="mx-5 mb-8 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-white p-5 shadow-lg sm:mx-7" aria-labelledby="send-heading">
      <h2 id="send-heading" className="basis-full text-[17px] font-bold">Compartir informe</h2>
      <div className="min-w-[260px] flex-1"><label htmlFor="report-recipient" className="block text-sm font-bold">Destinatario autorizado</label>
        <select id="report-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">{recipients.length ? 'Selecciona un destinatario' : 'No hay destinatarios autorizados configurados'}</option>
          {recipients.map((address) => <option key={address} value={address}>{address}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void sendReport()} disabled={!recipient || isSending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">→</span>{isSending ? 'Enviando…' : 'Enviar informe'}</button>
        <a href={`/api/reports/${report.reportId}/pdf`} className="inline-flex min-h-11 items-center rounded-lg border border-rose-200 bg-white px-5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">Descargar PDF</a>
      </div>
      {recipient && <p className="basis-full text-xs text-gray-500">Destinatario seleccionado: {recipient} · Asunto: Informe estudiantes</p>}
      {sendMessage && <p role={sendFailed ? 'alert' : 'status'} className={'basis-full text-sm ' + (sendFailed ? 'text-red-700' : 'text-emerald-700')}>{sendMessage}</p>}
    </section>
  </main>
}

const statTones = {
  blue: 'from-blue-50 to-blue-100 text-blue-900',
  green: 'from-emerald-50 to-emerald-100 text-green-900',
  rose: 'from-rose-50 to-rose-100 text-rose-900',
}

function StatCard({ tone, icon, label, value, detail }: { tone: keyof typeof statTones; icon: string; label: string; value: string; detail: string }) {
  return <div className={'relative rounded-2xl bg-gradient-to-r px-4 py-3 ' + statTones[tone]}>
    <span className="absolute right-4 top-3 text-lg opacity-70" aria-hidden="true">{icon}</span>
    <p className="text-xs font-bold">{label}</p>
    <strong className="mt-1 block text-2xl leading-none">{value}</strong>
    <p className="mt-1 text-[11px] opacity-80">{detail}</p>
  </div>
}
