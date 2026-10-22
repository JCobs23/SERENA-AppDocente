import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

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
  connected: number
  students: SupervisionStudent[]
  liveCounts?: Record<string, number>
}

export default function SupervisionPanel({ stage, connected, students, liveCounts }: Props) {
  const field = stage === 2 ? 'emotion' : stage === 5 ? 'reflection' : 'decision'
  const title = stage === 2 ? 'Emociones' : stage === 5 ? 'Reflexiones' : stage >= 3 ? 'Decisiones' : 'Participación'
  const active = students.filter((student) => student.connected)
  const studentCounts = active.reduce<Record<string, number>>((result, student) => {
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
  const counts = liveCounts ?? studentCounts
  const responded = stage === 5
    ? active.filter((student) => student.reflection).length
    : Object.values(counts).reduce((total, count) => total + count, 0)
  const labels = Object.keys(counts)
  const palette = ['#d51f28', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7']

  return (
    <aside id="supervision-panel" aria-labelledby="supervision-title" className="fixed inset-y-20 left-4 z-30 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#171717]/95 text-white shadow-2xl backdrop-blur sm:left-6">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-400">Panel privado · Docente</p>
          <h2 id="supervision-title" className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{responded}/{connected}</span>
      </header>
      <p className="sr-only">Vista privada del docente. Esta información no se muestra en la proyección.</p>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_12rem] gap-3 p-3">
        <ul className="min-h-0 space-y-2 overflow-y-auto" aria-label="Estado de respuesta por estudiante">
          {active.map((student) => {
            const answer = student[field]
            const displayAnswer = stage === 5 && answer
              ? answer.split(',').map((value, index) => `P${index + 1}: ${value.trim() === 'yes' ? 'Sí' : 'No'}`).join(' · ')
              : answer
            return <li key={student.studentId} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate font-semibold text-white">{student.studentName}</strong>
                <span className="block truncate text-xs text-white/60">{displayAnswer || 'Sin respuesta todavía'}</span>
              </span>
              <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (answer ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200')}>
                {answer ? 'Respondió' : 'Pendiente'}
              </span>
            </li>
          })}
          {active.length === 0 && <li className="text-sm text-white/60">No hay estudiantes conectados.</li>}
        </ul>
        <div className="relative min-h-0 rounded-lg border border-white/10 bg-white/[0.04] p-2" aria-label={`${title}: gráfico de respuestas`}>
          {labels.length ? <Doughnut
            data={{ labels, datasets: [{ data: labels.map((label) => counts[label]), backgroundColor: labels.map((_, index) => palette[index % palette.length]), borderColor: '#fff', borderWidth: 3 }] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#fff', boxWidth: 10, padding: 10 } }, tooltip: { enabled: true } } }}
          /> : <p className="grid h-full place-items-center text-sm text-white/60">Esperando respuestas de los estudiantes.</p>}
        </div>
      </div>
    </aside>
  )
}
