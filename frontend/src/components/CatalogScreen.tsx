import { useEffect, useState } from 'react'

type CatalogScreenProps = {
  onNarrativeSelect: () => void
  teacherEmail: string
  onLogout: () => void
  isCreatingSession: boolean
  sessionError: string
}

type Narrative = { title: string }
type Chapter = { title: string; narratives: Narrative[] }

const chapters: Chapter[] = [
  { title: 'Capítulo 1: Autoconocimiento y conciencia emocional', narratives: [
    { title: '¿Quién soy yo? Identidad personal y social' }, { title: 'Mis emociones tienen nombre' }, { title: 'El termómetro emocional' }, { title: 'Cuerpo y emoción' },
    { title: 'Mis fortalezas y áreas de mejora' }, { title: 'El diálogo interno' }, { title: 'Autoestima: quererme sin perfección' }, { title: 'Mi historia personal' },
  ] },
  { title: 'Capítulo 2: Autorregulación emocional', narratives: [
    { title: 'El semáforo de las emociones' }, { title: 'Respiración y calma' }, { title: 'La impulsividad y sus consecuencias' }, { title: 'Tolerancia a la frustración' },
    { title: 'Manejo del estrés y la ansiedad' }, { title: 'El poder de la pausa' }, { title: 'Estrategias saludables para regular lo que siento' }, { title: 'Autocontrol y libertad' },
  ] },
  { title: 'Capítulo 3: Empatía y perspectiva social', narratives: [
    { title: '¿Qué es la empatía?' }, { title: 'Empatía cognitiva y emocional' }, { title: 'Escucha activa' }, { title: 'Prejuicios y estereotipos' },
    { title: 'La diversidad como riqueza' }, { title: 'Empatía en acción' }, { title: 'Compasión: del sentir al actuar' }, { title: 'Empatía digital' },
  ] },
  { title: 'Capítulo 4: Habilidades de comunicación y relación', narratives: [
    { title: 'Comunicación asertiva' }, { title: 'Lenguaje verbal y no verbal' }, { title: 'El arte de conversar' }, { title: 'Resolución de conflictos' },
    { title: 'Negociación y acuerdos justos' }, { title: 'Críticas constructivas' }, { title: 'Construir confianza' }, { title: 'Vínculos saludables' },
  ] },
  { title: 'Capítulo 5: Colaboración y trabajo en equipo', narratives: [
    { title: '¿Qué es trabajar en equipo?' }, { title: 'Roles y responsabilidades' }, { title: 'Cooperación vs. competencia' }, { title: 'Liderazgo positivo' },
    { title: 'Toma de decisiones colectivas' }, { title: 'Manejo de desacuerdos' }, { title: 'Metas compartidas' }, { title: 'Celebrar los logros del equipo' },
  ] },
  { title: 'Capítulo 6: Toma de decisiones responsables', narratives: [
    { title: 'Decisiones cotidianas' }, { title: 'El proceso de decidir' }, { title: 'Consecuencias a corto y largo plazo' }, { title: 'Influencia social y presión de grupo' },
    { title: 'Valores como brújula' }, { title: 'Decisiones éticas' }, { title: 'Aprender de los errores' }, { title: 'Responsabilidad sobre mis elecciones' },
  ] },
  { title: 'Capítulo 7: Valores, principios y ética personal', narratives: [
    { title: '¿Qué son los valores?' }, { title: 'Honestidad y confianza' }, { title: 'Justicia' }, { title: 'Respeto y dignidad' },
    { title: 'Responsabilidad y compromiso' }, { title: 'Solidaridad' }, { title: 'Integridad' }, { title: 'Mi código ético personal' },
  ] },
  { title: 'Capítulo 8: Ética en las relaciones y convivencia', narratives: [
    { title: 'Convivencia pacífica' }, { title: 'Derechos humanos' }, { title: 'Igualdad y no discriminación' }, { title: 'Libertad con responsabilidad' },
    { title: 'Justicia restaurativa' }, { title: 'Cultura de paz' }, { title: 'Ciudadanía activa' }, { title: 'Ética del cuidado' },
  ] },
  { title: 'Capítulo 9: Ética en el mundo digital y global', narratives: [
    { title: 'Ciudadanía digital' }, { title: 'Huella digital' }, { title: 'Verdad y desinformación' }, { title: 'Respeto en redes' },
    { title: 'Privacidad y datos personales' }, { title: 'Consumo responsable y ética ambiental' }, { title: 'Ética global' }, { title: 'Tecnología con valores' },
  ] },
  { title: 'Capítulo 10: Proyecto de vida y compromiso ético', narratives: [
    { title: 'Mis sueños y metas' }, { title: 'Plan de vida' }, { title: 'Habilidades para la vida' }, { title: 'Ética y proyecto profesional' },
    { title: 'Contribuir a mi comunidad' }, { title: 'Resiliencia' }, { title: 'Ciudadanía global' }, { title: 'Mi compromiso ético' },
  ] },
]

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

function NarrativeCover({ source, title }: { source?: string; title: string }) {
  if (!source) return null
  return <img src={source} alt={`Portada de ${title}`} onError={(event) => { event.currentTarget.style.display = 'none' }} className="absolute inset-0 h-full w-full object-cover" />
}

export default function CatalogScreen({ onNarrativeSelect, teacherEmail, onLogout, isCreatingSession, sessionError }: CatalogScreenProps) {
  const [covers, setCovers] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    // En desarrollo Vite redirige esta ruta al servidor de portadas. Así el
    // catálogo también funciona si Vite elige un puerto distinto de 5173.
    fetch(import.meta.env.VITE_MEDIA_SERVER_URL ?? '/covers-manifest')
      .then(async (response) => response.ok ? response.json() as Promise<{ covers: Record<string, string> }> : Promise.reject())
      .then((manifest) => { if (!cancelled) setCovers(manifest.covers) })
      .catch(() => { /* El catálogo conserva el fondo oscuro si no hay una portada disponible. */ })

    return () => { cancelled = true }
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 text-gray-950">
      <header className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <span className="text-lg font-bold tracking-tight text-red-700">Serena</span>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-gray-600 sm:inline">{teacherEmail}</span><button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><UserIcon /></button></div>
      </header>

      <div className="space-y-10 px-4 py-9 sm:px-6 lg:px-8">
        {sessionError && <p role="alert" className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sessionError}</p>}
        {isCreatingSession && <p role="status" className="mx-auto max-w-2xl text-center text-sm text-gray-600">Creando la sesión…</p>}
        {chapters.map((chapter, chapterIndex) => (
          <section key={chapter.title} aria-labelledby={`chapter-${chapterIndex}`}>
            <h1 id={`chapter-${chapterIndex}`} className="mb-4 text-xl font-extrabold tracking-tight text-gray-950">{chapter.title}</h1>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {chapter.narratives.map((narrative, narrativeIndex) => {
                const globalNarrative = chapterIndex * 8 + narrativeIndex + 1
                const isFirstNarrative = globalNarrative === 1
                const card = <><div className="aspect-video bg-gray-800" /><NarrativeCover source={covers[String(chapterIndex + 1)]} title={narrative.title} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-10"><p className="text-xs font-semibold text-red-500">Capítulo {chapterIndex + 1}</p><p className="mt-1 text-sm font-bold leading-tight text-white">Narrativa {narrativeIndex + 1}: {narrative.title}</p></div></>
                return isFirstNarrative ? <button key={narrative.title} type="button" disabled={isCreatingSession} onClick={onNarrativeSelect} aria-busy={isCreatingSession} className="relative overflow-hidden rounded-xl text-left shadow-md transition duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{card}</button> : <article key={narrative.title} className="relative overflow-hidden rounded-xl shadow-md">{card}</article>
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
