import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import type { SessionReport } from '../lib/reports'

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
  const reflections = report.reflections
  const positive = reflections.reduce((sum, item) => sum + item.yes, 0)
  const answered = reflections.reduce((sum, item) => sum + item.yes + item.no, 0)
  const positivePercent = answered ? Math.round(positive / answered * 100) : 0

  useEffect(() => {
    let cancelled = false
    apiRequest<{ recipients: string[] }>('/reports/recipients')
      .then((result) => {
        if (cancelled) return
        setRecipients(result.recipients)
        const preferred = result.recipients.find((address) => address.toLowerCase() === 'javierlainv@gmail.com')
        setRecipient(preferred ?? result.recipients[0] ?? '')
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
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-950 sm:px-8">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold">Reporte grupal</h1><p className="mt-1 text-sm text-gray-600">Sesión {report.sessionCode} · {new Date(report.createdAt).toLocaleString()}</p></div>
      <button type="button" onClick={onFinish} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">{finishLabel}</button>
    </header>
    <p role="note" className="mx-auto mt-3 max-w-6xl rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">Este reporte contiene resultados agregados del grupo. No incluye nombres ni identificadores de estudiantes.</p>
    <section className="mx-auto mt-5 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Estadísticas grupales">
      <SummaryCard title="Participantes" value={`${report.participantCount}`} detail={`${report.connectedParticipants} conectados al cierre`} />
      <SummaryCard title="Estado" value={report.status === 'completed' ? 'Completada' : 'Parcial'} detail={`Etapa ${report.stageReached} de 5`} />
      <SummaryCard title="Reflexiones positivas" value={`${positivePercent}%`} detail={`${positive} de ${answered} respuestas`} />
      <SummaryCard title="Votos finales" value={`${report.continueVotes + report.alternativeVotes}`} detail={`${report.continueVotes} continuar · ${report.alternativeVotes} explorar`} />
    </section>
    <section className="mx-auto mt-5 grid max-w-6xl gap-5 lg:grid-cols-2">
      <article className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Distribución de emociones</h2><Distribution values={report.emotionCounts} total={report.participantCount} />
        <h2 className="mt-6 text-lg font-bold">Distribución de decisiones</h2><Distribution values={report.decisionCounts} total={report.participantCount} /></article>
      <article className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Reflexión grupal</h2>
        <div className="mt-3 space-y-3">{reflections.map((item) => <div key={item.question} className="rounded-lg border border-gray-100 p-3"><h3 className="text-sm font-semibold">Pregunta {item.question}</h3><p className="mt-1 text-sm text-gray-600">Sí: {item.yes} · No: {item.no} · Sin respuesta: {item.unanswered}</p></div>)}</div>
        <h2 className="mt-6 text-lg font-bold">Distribución de votos</h2><Distribution values={{ 'Continuar': report.continueVotes, 'Explorar otra decisión': report.alternativeVotes }} total={report.continueVotes + report.alternativeVotes} />
      </article>
    </section>
    <section className="mx-auto mt-5 flex max-w-6xl flex-wrap items-end justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="min-w-[260px] flex-1"><label htmlFor="report-recipient" className="block text-sm font-bold">Destinatario autorizado</label>
        <select id="report-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">{recipients.length ? 'Selecciona un destinatario' : 'No hay destinatarios autorizados configurados'}</option>
          {recipients.map((address) => <option key={address} value={address}>{address}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void sendReport()} disabled={!recipient || isSending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{isSending ? 'Enviando…' : 'Enviar informe'}</button>
        <a href={`/api/reports/${report.reportId}/pdf`} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-950">Descargar PDF</a>
      </div>
      {recipient && <p className="basis-full text-xs text-gray-500">Destinatario seleccionado: {recipient} · Asunto: Informe estudiantes</p>}
      {sendMessage && <p role={sendFailed ? 'alert' : 'status'} className={'basis-full text-sm ' + (sendFailed ? 'text-red-700' : 'text-emerald-700')}>{sendMessage}</p>}
    </section>
  </main>
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-600">{title}</p><strong className="mt-2 block text-3xl text-blue-900">{value}</strong><p className="mt-1 text-xs text-gray-500">{detail}</p></article>
}

function Distribution({ values, total }: { values: Record<string, number>; total: number }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  const highest = entries[0]?.[1] ?? 0
  return <ul className="mt-3 space-y-3">{entries.length ? entries.map(([label, count]) => <li key={label} className="rounded-lg p-2">
    <div className="flex justify-between gap-3 text-sm"><span>{label}{count === highest ? ' · Mayoría' : ''}</span><strong>{count} ({total ? Math.round(count / total * 100) : 0}%)</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200"><div className={'h-full rounded-full ' + (count === highest ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${total ? count / total * 100 : 0}%` }} /></div>
  </li>) : <li className="py-3 text-sm text-gray-500">Sin respuestas registradas.</li>}</ul>
}
