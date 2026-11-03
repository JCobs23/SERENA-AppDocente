import { useState } from 'react'
import type { SupervisionStudent } from './SupervisionPanel'

export default function SessionSummary({ students, votes, onFinish }: { students: SupervisionStudent[]; votes: { continue: number; alternative: number }; onFinish: () => void }) {
  const [selected, setSelected] = useState<SupervisionStudent | null>(null)
  const participants = students
  const decisions = participants.reduce<Record<string, number>>((result, student) => {
    if (student.decision) result[student.decision] = (result[student.decision] ?? 0) + 1
    return result
  }, {})
  const emotions = participants.reduce<Record<string, number>>((result, student) => {
    if (student.emotion) result[student.emotion] = (result[student.emotion] ?? 0) + 1
    return result
  }, {})
  const reflectionAnswers = participants.flatMap((student) => student.reflection?.split(',') ?? [])
  const positive = reflectionAnswers.filter((answer) => answer.trim() === 'yes').length
  const percentage = reflectionAnswers.length ? Math.round(positive / reflectionAnswers.length * 100) : 0
  const totalVotes = votes.continue + votes.alternative

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-950 sm:px-8">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold">Resumen de la sesión</h1><p className="mt-1 text-sm text-gray-600">Resultados de {participants.length} participantes registrados en esta sesión.</p></div>
      <button type="button" onClick={onFinish} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">Finalizar y volver al catálogo</button>
    </header>
    <section className="mx-auto mt-6 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Estadísticas de la sesión">
      <SummaryCard title="Participantes" value={`${participants.length}`} detail="Estudiantes que se unieron a esta sesión" />
      <SummaryCard title="Decisiones registradas" value={`${Object.values(decisions).reduce((sum, count) => sum + count, 0)}`} detail={`${Object.keys(decisions).length} alternativas elegidas`} />
      <SummaryCard title="Reflexiones positivas" value={`${percentage}%`} detail={`${positive} de ${reflectionAnswers.length} respuestas afirmativas`} />
      <SummaryCard title="Votos finales" value={`${totalVotes}`} detail={`${votes.continue} continuar · ${votes.alternative} explorar`} />
    </section>
    <section className="mx-auto mt-5 grid max-w-6xl gap-5 lg:grid-cols-2">
      <article className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Distribución de emociones</h2><Distribution values={emotions} total={participants.length} />
        <h2 className="mt-6 text-lg font-bold">Distribución de decisiones</h2><Distribution values={decisions} total={participants.length} />
        {totalVotes > 0 && <><h2 className="mt-6 text-lg font-bold">Votación final</h2><Distribution values={{ 'Continuar': votes.continue, 'Explorar otra decisión': votes.alternative }} total={totalVotes} /></>}</article>
      <article className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Participantes y resultados</h2><p className="mt-1 text-sm text-gray-600">Selecciona un resultado para revisar sus respuestas individuales.</p>
        <ul className="mt-4 divide-y divide-gray-100">{participants.map((student) => <li key={student.studentId}>
          <button type="button" onClick={() => setSelected(student)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-600">
            <span><strong className="block">{student.studentName}</strong><span className="text-sm text-gray-600">{student.decision || 'Sin decisión'} · {student.emotion || 'Sin emoción'}</span></span><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Ver detalle</span>
          </button>
        </li>)}</ul>
      </article>
    </section>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="student-detail-title" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gray-950 px-5 py-4 text-white"><div><h2 id="student-detail-title" className="font-bold">{selected.studentName}</h2><p className="text-xs text-white/70">Detalle individual de la sesión</p></div><button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(null)} className="rounded-full bg-white/15 px-3 py-1">×</button></header>
        <div className="space-y-4 p-5"><Detail label="Emoción identificada" value={selected.emotion} /><Detail label="Decisión tomada" value={selected.decision} /><div><h3 className="text-xs font-bold uppercase text-gray-500">Respuestas de reflexión</h3>{selected.reflection ? <ul className="mt-2 space-y-2">{selected.reflection.split(',').map((answer, index) => <li key={index} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">Pregunta {index + 1}: <strong>{answer.trim() === 'yes' ? 'Sí' : 'No'}</strong></li>)}</ul> : <p className="mt-2 text-sm text-gray-500">No respondió las preguntas de reflexión.</p>}</div></div>
      </section>
    </div>}
  </main>
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-600">{title}</p><strong className="mt-2 block text-3xl text-blue-900">{value}</strong><p className="mt-1 text-xs text-gray-500">{detail}</p></article>
}

function Distribution({ values, total }: { values: Record<string, number>; total: number }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  const highest = entries[0]?.[1] ?? 0
  return <ul className="mt-3 space-y-3">{entries.length ? entries.map(([label, count]) => <li key={label} className="rounded-lg p-2" title={count === highest ? 'Opción con más selecciones' : undefined}>
    <div className="flex justify-between gap-3 text-sm"><span>{label}{count === highest ? ' · Mayoría' : ''}</span><strong>{count} ({total ? Math.round(count / total * 100) : 0}%)</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200"><div className={'h-full rounded-full ' + (count === highest ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${total ? count / total * 100 : 0}%` }} /></div>
  </li>) : <li className="py-3 text-sm text-gray-500">Sin respuestas registradas.</li>}</ul>
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return <div><h3 className="text-xs font-bold uppercase text-gray-500">{label}</h3><p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm font-semibold">{value || 'Sin respuesta registrada'}</p></div>
}
