import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '../lib/api'

type Student = { id: string; name: string; ready?: boolean; connected?: boolean }
type StudentsPayload = Student[] | { students: Student[] }
type WaitingRoomProps = { sessionCode: string; onLogout: () => void; onReturnToChapters: () => void; onStartNarrative: () => void; isStartingNarrative: boolean }

const shortcuts = [
  { key: 'Space', icon: '▱', description: 'Pausar / reanudar narrativa' }, { key: '→', icon: '→', description: 'Avanzar 5 segundos' },
  { key: '←', icon: '←', description: 'Retroceder 5 segundos' }, { key: 'M', icon: '⌨', description: 'Silenciar / activar audio' },
  { key: 'F', icon: '⌨', description: 'Pantalla completa' }, { key: 'Esc', icon: '⌨', description: 'Salir de pantalla completa' },
  { key: '↑ / ↓', icon: '⌨', description: 'Ajustar volumen' },
]

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4 sm:pt-20 sm:pr-8"><button type="button" aria-label="Cerrar ventana" onClick={onClose} className="fixed inset-0 cursor-default" />{children}</div>
}

function NarrativeControls({ onClose }: { onClose: () => void }) {
  return <Overlay onClose={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="controls-title" className="relative z-10 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#463535] p-6 text-white shadow-2xl"><button type="button" onClick={onClose} aria-label="Cerrar controles" className="absolute right-4 top-4 text-xl text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">×</button><h2 id="controls-title" className="pr-10 text-2xl font-extrabold tracking-tight text-white">Controles de narrativa</h2><p className="mt-1 text-sm text-[#a89b9b]">Usa estos atajos para controlar la reproducción.</p><div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">{shortcuts.map((shortcut) => <div key={shortcut.key} className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#723b3e] text-base font-semibold text-white">{shortcut.icon}</span><div><p className="text-sm font-bold text-white">{shortcut.key}</p><p className="mt-0.5 text-xs leading-snug text-gray-300">{shortcut.description}</p></div></div>)}</div><footer className="mt-6 rounded-lg border border-[#7d3437] bg-[#542f30] px-3 py-3"><p className="flex items-center gap-1.5 text-sm font-bold text-white"><span aria-hidden="true">💡</span>Consejo</p><p className="mt-1 text-xs leading-relaxed text-gray-300">Durante una sesión activa, estos controles estarán disponibles.</p></footer></aside></Overlay>
}

function TechnicalStatistics({ students, onClose }: { students: Student[]; onClose: () => void }) {
  const connected = students.filter((student) => student.connected !== false).length
  const ready = students.filter((student) => student.connected !== false && student.ready === true).length
  return <Overlay onClose={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="technical-title" className="relative z-10 w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#463535] p-6 text-white shadow-2xl"><button type="button" onClick={onClose} aria-label="Cerrar menú técnico" className="absolute right-4 top-4 text-xl text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">×</button><h2 id="technical-title" className="pr-10 text-2xl font-extrabold leading-tight text-white">MENU DE CONTROLES TECNICOS Y ESTADISTICAS DE ESTUDIANTE</h2><p className="mt-2 text-sm text-[#a89b9b]">Resumen de la sesión antes de iniciar la narrativa.</p><div className="mt-6 grid grid-cols-3 gap-3"><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-2xl font-black text-white">{connected}</p><p className="mt-1 text-xs text-gray-300">Conectados</p></div><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-2xl font-black text-emerald-400">{ready}</p><p className="mt-1 text-xs text-gray-300">Listos</p></div><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-2xl font-black text-gray-300">{students.length - connected}</p><p className="mt-1 text-xs text-gray-300">Sin conexión</p></div></div><p className="mt-5 rounded-lg border border-[#7d3437] bg-[#542f30] px-3 py-3 text-xs leading-relaxed text-gray-300">La narrativa se habilitará cuando todos los estudiantes conectados estén listos.</p></aside></Overlay>
}

export default function WaitingRoom({ sessionCode, onLogout, onReturnToChapters, onStartNarrative, isStartingNarrative }: WaitingRoomProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const [isTechnicalMenuOpen, setIsTechnicalMenuOpen] = useState(true)

  useEffect(() => {
    const normalizeStudents = (payload: StudentsPayload) => (Array.isArray(payload) ? payload : payload.students).map((student) => ({ ...student, ready: student.ready === true, connected: student.connected !== false }))
    const updateStudents = (payload: StudentsPayload) => setStudents(normalizeStudents(payload))
    const refreshStudents = async () => { try { updateStudents(await apiRequest<{ students: Student[] }>(`/sessions/${sessionCode}/students`)) } catch { /* Conserva la última lista conocida. */ } }
    void refreshStudents()
    // The API calculates presence from each Unity client's heartbeat. Polling every
    // second makes joins, readiness changes, and unexpected disconnects visible live.
    const pollingId = window.setInterval(() => { void refreshStudents() }, 1000)
    return () => { window.clearInterval(pollingId) }
  }, [sessionCode])

  const joinedStudents = students.length
  const connectedStudents = students.filter((student) => student.connected !== false).length
  const readyStudents = students.filter((student) => student.connected !== false && student.ready === true).length
  const areAllStudentsReady = joinedStudents > 0 && connectedStudents === joinedStudents && readyStudents === joinedStudents
  const connectionCode = sessionCode.match(/.{1,3}/g)?.join(' ') ?? sessionCode

  return <main className="min-h-screen bg-white px-4 py-5 text-gray-950 sm:px-8"><header className="flex items-center justify-between"><button type="button" onClick={onReturnToChapters} className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 transition hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><span aria-hidden="true" className="text-lg">←</span>Return to chapters</button><div className="flex items-center gap-3"><button type="button" onClick={() => setIsTechnicalMenuOpen(true)} className="hidden text-sm font-medium text-gray-600 hover:text-red-700 sm:block">Estadísticas</button><button type="button" onClick={onLogout} className="text-sm font-medium text-gray-600 hover:text-red-700">Cerrar sesión</button><button type="button" onClick={() => setIsControlsOpen(true)} aria-label="Abrir controles de narrativa" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">?<span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" /></button></div></header><section className="mx-auto mt-24 w-full max-w-4xl"><header className="text-center"><h1 className="text-4xl font-extrabold tracking-tight text-black">Waiting room</h1><p className="mt-2 text-base font-medium text-gray-600">Chapter 1: Narrative 1</p><p className="mt-3 text-sm text-gray-500">Preparando sesión</p></header><div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2"><section className="min-h-[310px] rounded-2xl border border-gray-100 bg-white p-7 shadow-sm"><h2 className="text-base font-bold text-gray-950">Connection Code</h2><div className="relative mt-8 inline-block"><span aria-hidden="true" className="absolute inset-0 rounded-full bg-red-300/30 blur-2xl" /><p className="relative text-5xl font-black tracking-[0.15em] text-red-600 drop-shadow-md sm:text-6xl">{connectionCode}</p></div></section><section className="min-h-[310px] rounded-2xl border border-gray-100 bg-white p-7 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-base font-bold text-gray-950">Students</h2><span className="text-sm text-gray-500">{connectedStudents}/{joinedStudents} conectados</span></div><div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">{students.map((student) => { const disconnected = student.connected === false; const ready = !disconnected && student.ready === true; return <div key={student.id} className={`flex min-w-0 items-center gap-3 ${disconnected ? 'text-gray-400' : 'text-gray-800'}`}><span className={`h-3 w-3 shrink-0 rounded-full ${disconnected ? 'bg-gray-400' : ready ? 'bg-emerald-500' : 'bg-red-500'}`} /><span className="truncate text-sm font-medium">{student.name}</span></div> })}</div></section></div><button type="button" disabled={!areAllStudentsReady || isStartingNarrative} onClick={onStartNarrative} className={`mx-auto mt-9 flex w-full max-w-xs items-center justify-center rounded-lg px-6 py-3 text-sm font-bold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${areAllStudentsReady && !isStartingNarrative ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'cursor-not-allowed bg-red-400/80 text-white'}`}>{areAllStudentsReady ? (isStartingNarrative ? 'Iniciando narrativa…' : 'Students Ready!') : `Waiting for Students (${readyStudents}/${joinedStudents})`}</button></section>{isTechnicalMenuOpen && <TechnicalStatistics students={students} onClose={() => setIsTechnicalMenuOpen(false)} />}{isControlsOpen && <NarrativeControls onClose={() => setIsControlsOpen(false)} />}</main>
}
