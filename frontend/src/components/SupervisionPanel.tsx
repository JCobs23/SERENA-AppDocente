export type SupervisionStudent = {
  studentId: string
  studentName: string
  emotion: string | null
  decision: string | null
  reflection: string | null
  connected: boolean
  ready: boolean
}

type Props = {
  stage: number
  students: SupervisionStudent[]
}

export default function SupervisionPanel({ stage, students }: Props) {
  const field = stage === 2 ? 'emotion' : stage === 5 ? 'reflection' : 'decision'
  const title = stage === 2 ? 'Emociones' : stage === 5 ? 'Reflexiones' : stage >= 3 ? 'Decisiones' : 'Participación'
  // La sesión conserva el roster completo; desconectarse no elimina una respuesta ya registrada.
  const participants = students
  const studentCounts = participants.reduce<Record<string, number>>((result, student) => {
    const answer = student[field]
    if (!answer) return result
    if (stage === 5) {
      answer.split(',').forEach((value, index) => {
        const label = `P${index + 1} · ${value.trim() === 'yes' ? 'Sí' : 'No'}`
        result[label] = (result[label] ?? 0) + 1
      })
    } else {
      result[answer] = (result[answer] ?? 0) + 1
    }
    return result
  }, {})
  const counts = studentCounts
  const responded = stage === 5
    ? participants.filter((student) => student.reflection).length
    : Object.values(counts).reduce((total, count) => total + count, 0)
  const labels = Object.keys(counts)
  const palette = ['#d51f28', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7']
  const highest = Math.max(0, ...Object.values(counts))

  return (
    <aside id="supervision-panel" aria-labelledby="supervision-title" className="fixed inset-y-20 left-4 z-30 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#171717]/95 text-white shadow-2xl backdrop-blur sm:left-6">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-400">Panel privado · Docente</p>
          <h2 id="supervision-title" className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{responded}/{participants.length}</span>
      </header>
      <p className="sr-only">Vista privada del docente. Esta información no se muestra en la proyección.</p>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_12rem] gap-3 p-3">
        <ul className="min-h-0 space-y-2 overflow-y-auto" aria-label="Estado de respuesta por estudiante">
          {participants.map((student) => {
            const answer = student[field]
            const displayAnswer = stage === 5 && answer
              ? answer.split(',').map((value, index) => `P${index + 1}: ${value.trim() === 'yes' ? 'Sí' : 'No'}`).join(' · ')
              : answer
            return <li key={student.studentId} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate font-semibold text-white">{student.studentName}</strong>
                <span className="block truncate text-xs text-white/60">{displayAnswer || 'Sin respuesta todavía'}</span>
              </span>
              <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (answer ? 'bg-emerald-500/20 text-emerald-200' : student.connected ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-white/60')}>
                {answer ? 'Respondió' : student.connected ? 'Pendiente' : 'Desconectado'}
              </span>
            </li>
          })}
          {participants.length === 0 && <li className="text-sm text-white/60">Aún no hay participantes en esta sesión.</li>}
        </ul>
        <div className="min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-3" aria-label={`${title}: distribución de respuestas`} aria-live="polite">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-white/65">Distribución · {responded} respuestas</h3>
          {labels.length ? <ul className="space-y-2">{labels.map((label, index) => {
            const count = counts[label]
            const isLeader = count === highest
            return <li key={label} className={'rounded-md px-2 py-1.5 ' + (isLeader ? 'bg-emerald-400/15 ring-1 ring-emerald-300/60' : '')}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate">{isLeader ? '★ ' : ''}{label}</span><strong>{count} · {responded ? Math.round(count / responded * 100) : 0}%{isLeader ? ' · Mayoría' : ''}</strong></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${responded ? count / responded * 100 : 0}%`, backgroundColor: palette[index % palette.length] }} /></div>
            </li>
          })}</ul> : <p className="grid h-24 place-items-center text-sm text-white/60">Esperando respuestas de los estudiantes.</p>}
        </div>
      </div>
    </aside>
  )
}
