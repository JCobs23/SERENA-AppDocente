import { useEffect, useRef, useState } from 'react'
import { isSoundEnabled, playSound, setSoundEnabled } from '../lib/sounds'

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

// H.U. 6.2.2: señales moderadas. Cuando llega una respuesta, la fila se resalta con un tono
// suave que se desvanece en 1,5 s y suena una nota corta a bajo volumen (se puede silenciar).
const RECENT_MS = 1500

export default function SupervisionPanel({ stage, students }: Props) {
  const field = stage === 2 ? 'emotion' : stage === 5 ? 'reflection' : 'decision'
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled('supervision'))
  const [recent, setRecent] = useState<string[]>([])
  const baselineRef = useRef<{ stage: number; ids: Set<string> } | null>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), [])

  useEffect(() => {
    const ids = new Set(students.filter((student) => student[field]).map((student) => student.studentId))
    const previous = baselineRef.current
    baselineRef.current = { stage, ids }
    // Al abrir el panel o cambiar de etapa solo se toma la línea base: no se avisa por respuestas que ya existían.
    if (!previous || previous.stage !== stage) return
    const fresh = [...ids].filter((id) => !previous.ids.has(id))
    if (!fresh.length) return
    playSound('response-received', 'supervision')
    setRecent((current) => [...current, ...fresh])
    timersRef.current.push(window.setTimeout(() => setRecent((current) => current.filter((id) => !fresh.includes(id))), RECENT_MS))
  }, [students, stage, field])

  function toggleSound() {
    setSoundEnabled('supervision', !soundOn)
    setSoundOn(!soundOn)
  }

  const title = stage === 2 ? 'Emotions' : stage === 5 ? 'Reflections' : stage >= 3 ? 'Decisions' : 'Participation'
  // La sesión conserva el roster completo; desconectarse no elimina una respuesta ya registrada.
  const participants = students
  const studentCounts = participants.reduce<Record<string, number>>((result, student) => {
    const answer = student[field]
    if (!answer) return result
    if (stage === 5) {
      answer.split(',').forEach((value, index) => {
        const label = `Q${index + 1} · ${value.trim() === 'yes' ? 'Yes' : 'No'}`
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
  // Paleta de saturación media para no competir con la proyección (H.U. 6.2.2).
  const palette = ['#7aa7c7', '#7fbf9f', '#d6b26e', '#a99ad1', '#d09a8a', '#86b9b6', '#c9a7c4', '#a8b48a']
  const highest = Math.max(0, ...Object.values(counts))

  return (
    <aside id="supervision-panel" aria-labelledby="supervision-title" className="fixed inset-y-20 left-4 z-30 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#171717]/95 text-white shadow-2xl backdrop-blur sm:left-6">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-200/80">Private panel · Teacher</p>
          <h2 id="supervision-title" className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleSound} aria-pressed={soundOn} title={soundOn ? 'Mute the response alert' : 'Turn on the response alert'} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/20">{soundOn ? '🔈 Sound' : '🔇 Muted'}</button>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{responded}/{participants.length}</span>
        </div>
      </header>
      <p className="sr-only">Private teacher view. This information is not shown on the projection.</p>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_12rem] gap-3 p-3">
        <ul className="min-h-0 space-y-2 overflow-y-auto" aria-label="Response status per student">
          {participants.map((student) => {
            const answer = student[field]
            const displayAnswer = stage === 5 && answer
              ? answer.split(',').map((value, index) => `Q${index + 1}: ${value.trim() === 'yes' ? 'Yes' : 'No'}`).join(' · ')
              : answer
            const isRecent = recent.includes(student.studentId)
            return <li key={student.studentId} className={'flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-1000 motion-reduce:transition-none ' + (isRecent ? 'border-emerald-300/40 bg-emerald-300/[0.12]' : 'border-white/10 bg-white/[0.06]')}>
              <span className="min-w-0">
                <strong className="block truncate font-semibold text-white">{student.studentName}</strong>
                <span className="block truncate text-xs text-white/60">{displayAnswer || 'No response yet'}</span>
              </span>
              <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (answer ? 'bg-emerald-500/20 text-emerald-200' : student.connected ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-white/60')}>
                {answer ? 'Answered' : student.connected ? 'Pending' : 'Disconnected'}
              </span>
            </li>
          })}
          {participants.length === 0 && <li className="text-sm text-white/60">There are no participants in this session yet.</li>}
        </ul>
        <div className="min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-3" aria-label={`${title}: response distribution`} aria-live="polite">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-white/65">Distribution · {responded} responses</h3>
          {labels.length ? <ul className="space-y-2">{labels.map((label, index) => {
            const count = counts[label]
            const isLeader = count === highest
            return <li key={label} className={'rounded-md px-2 py-1.5 ' + (isLeader ? 'bg-white/[0.07] ring-1 ring-white/20' : '')}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate">{isLeader ? '★ ' : ''}{label}</span><strong>{count} · {responded ? Math.round(count / responded * 100) : 0}%{isLeader ? ' · Majority' : ''}</strong></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${responded ? count / responded * 100 : 0}%`, backgroundColor: palette[index % palette.length] }} /></div>
            </li>
          })}</ul> : <p className="grid h-24 place-items-center text-sm text-white/60">Waiting for student responses.</p>}
        </div>
      </div>
    </aside>
  )
}
