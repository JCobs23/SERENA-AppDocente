import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { socket } from '../lib/socket'

type Student = {
  id: string
  name: string
  ready?: boolean
}

type StudentsPayload = Student[] | { students: Student[] }

type WaitingRoomProps = {
  sessionCode: string
  onLogout: () => void
  onReturnToChapters: () => void
}

const shortcuts = [
  { key: 'Space', icon: '▱', description: 'Pause / Resume narrative' },
  { key: '→', icon: '→', description: 'Advance 5 seconds' },
  { key: '←', icon: '←', description: 'Go back 5 seconds' },
  { key: 'M', icon: '⌨', description: 'Mute / Unmute audio' },
  { key: 'F', icon: '⌨', description: 'Full screen' },
  { key: 'Esc', icon: '⌨', description: 'Exit full screen' },
  { key: '↑ / ↓', icon: '⌨', description: 'Adjust volume' },
]

function NarrativeControls({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-24 pr-8">
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0" />
      <aside role="dialog" aria-modal="true" aria-labelledby="controls-title" className="relative z-10 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#463535] p-6 text-white shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Cerrar controles" className="absolute right-4 top-4 text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">×</button>
        <h2 id="controls-title" className="pr-10 text-2xl font-extrabold tracking-tight text-white">Narrative Controls</h2>
        <p className="mt-1 text-sm text-[#a89b9b]">Use these keyboard shortcuts to control narrative playback</p>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#723b3e] text-base font-semibold text-white">{shortcut.icon}</span>
              <div><p className="text-sm font-bold text-white">{shortcut.key}</p><p className="mt-0.5 text-xs leading-snug text-gray-300">{shortcut.description}</p></div>
            </div>
          ))}
        </div>

        <footer className="mt-6 rounded-lg border border-[#7d3437] bg-[#542f30] px-3 py-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-white"><span aria-hidden="true">💡</span>Consejo</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-300">Durante una sesión activa, estos controles estarán disponibles.</p>
        </footer>
      </aside>
    </div>
  )
}

export default function WaitingRoom({ sessionCode, onLogout, onReturnToChapters }: WaitingRoomProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const maxStudents = 12
  const readyStudents = students.filter((student) => student.ready).length

  useEffect(() => {
    const updateStudents = (payload: StudentsPayload) => {
      setStudents((Array.isArray(payload) ? payload : payload.students).map((student) => ({ ...student, ready: student.ready ?? true })))
    }

    const refreshStudents = async () => {
      try {
        const payload = await apiRequest<{ students: Student[] }>(`/sessions/${sessionCode}/students`)
        updateStudents(payload)
      } catch {
        // La sala conserva la última lista conocida mientras el servidor responde.
      }
    }

    socket.on('sala:actualizar_estudiantes', updateStudents)
    void refreshStudents()
    const pollingId = window.setInterval(() => { void refreshStudents() }, 2500)
    return () => {
      window.clearInterval(pollingId)
      socket.off('sala:actualizar_estudiantes', updateStudents)
    }
  }, [sessionCode])

  const connectionCode = sessionCode.match(/.{1,3}/g)?.join(' ') ?? sessionCode

  return (
    <main className="min-h-screen bg-white px-4 py-5 text-gray-950 sm:px-8">
      <header className="flex items-center justify-between">
        <button type="button" onClick={onReturnToChapters} className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 transition hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><span aria-hidden="true" className="text-lg">←</span>Return to chapters</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onLogout} className="text-sm font-medium text-gray-600 hover:text-red-700">Cerrar sesión</button>
          <button type="button" onClick={() => setIsControlsOpen(true)} aria-label="Abrir controles de narrativa" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">?<span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" /></button>
        </div>
      </header>

      <section className="mx-auto mt-24 w-full max-w-4xl">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-black">Waiting room</h1>
          <p className="mt-2 text-base font-medium text-gray-600">Chapter 1: Narrative 1</p>
          <p className="mt-3 text-sm text-gray-500">Preparing session</p>
        </header>

        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="min-h-[310px] rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <h2 className="text-base font-bold text-gray-950">Connection Code</h2>
            <div className="relative mt-8 inline-block"><span aria-hidden="true" className="absolute inset-0 rounded-full bg-red-300/30 blur-2xl" /><p className="relative text-5xl font-black tracking-[0.15em] text-red-600 drop-shadow-md sm:text-6xl">{connectionCode}</p></div>
          </section>

          <section className="min-h-[310px] rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold text-gray-950">Students</h2><span className="text-sm text-gray-500">{readyStudents}/{maxStudents} ready</span></div>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {students.map((student) => (
                <div key={student.id} className="flex min-w-0 items-center gap-3"><span className={`h-3 w-3 shrink-0 rounded-full ${student.ready ? 'bg-emerald-500' : 'bg-red-500'}`} /><span className="truncate text-sm font-medium text-gray-800">{student.name}</span></div>
              ))}
            </div>
          </section>
        </div>

        <button type="button" disabled className="mx-auto mt-9 flex w-full max-w-xs items-center justify-center rounded-lg bg-red-400/80 px-6 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed">Waiting for students ({readyStudents}/{maxStudents})</button>
      </section>

      {isControlsOpen && <NarrativeControls onClose={() => setIsControlsOpen(false)} />}
    </main>
  )
}
