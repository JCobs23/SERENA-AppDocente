type CatalogScreenProps = {
  onNarrativeSelect: () => void
  teacherEmail: string
  onLogout: () => void
  isCreatingSession: boolean
  sessionError: string
}

type Chapter = {
  title: string
  narrative: string
}

const chapters: Chapter[] = [
  { title: 'Capítulo 1: Creando un Aula Compasiva', narrative: 'Introducción a la Compasión' },
  { title: 'Capítulo 2: Desarrollando Empatía', narrative: 'Ejercicios de Empatía' },
  { title: 'Capítulo 3: Comunicación Efectiva', narrative: 'Habilidades de Comunicación' },
  { title: 'Capítulo 4: Navegación de Emociones', narrative: 'Regulación Emocional' },
  { title: 'Capítulo 5: Resolución de Conflictos', narrative: 'Estrategias de Resolución' },
  { title: 'Capítulo 6: Autoconocimiento', narrative: 'Reflexión Personal' },
  { title: 'Capítulo 7: Trabajo en Equipo', narrative: 'Colaboración' },
]

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

export default function CatalogScreen({ onNarrativeSelect, teacherEmail, onLogout, isCreatingSession, sessionError }: CatalogScreenProps) {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-950">
      <header className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <span className="text-lg font-bold tracking-tight text-red-700">Serena</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-gray-600 sm:inline">{teacherEmail}</span>
          <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><UserIcon /></button>
        </div>
      </header>

      <div className="space-y-10 px-4 py-9 sm:px-6 lg:px-8">
        {sessionError && <p role="alert" className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sessionError}</p>}
        {isCreatingSession && <p role="status" className="mx-auto max-w-2xl text-center text-sm text-gray-600">Creando la sesión…</p>}
        {chapters.map((chapter, chapterIndex) => (
          <section key={chapter.title} aria-labelledby={`chapter-${chapterIndex}`}>
            <h1 id={`chapter-${chapterIndex}`} className="mb-4 text-xl font-extrabold tracking-tight text-gray-950">{chapter.title}</h1>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, narrativeIndex) => {
                const isFirstNarrative = chapterIndex === 0 && narrativeIndex === 0
                const card = <><div className="aspect-video bg-gray-800" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-10"><p className="text-xs font-semibold text-red-500">Capítulo {chapterIndex + 1}</p><p className="mt-1 text-sm font-bold leading-tight text-white">Narrativa {narrativeIndex + 1}: {chapter.narrative}</p></div></>

                return isFirstNarrative ? (
                  <button key={narrativeIndex} type="button" disabled={isCreatingSession} onClick={onNarrativeSelect} aria-busy={isCreatingSession} className="relative overflow-hidden rounded-xl text-left shadow-md transition duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{card}</button>
                ) : (
                  <article key={narrativeIndex} className="relative overflow-hidden rounded-xl shadow-md">{card}</article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
