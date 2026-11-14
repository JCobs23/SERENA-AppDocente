type CatalogScreenProps = {
  onNarrativeSelect: () => void
  onOpenReports: () => void
  teacherEmail: string
  onLogout: () => void
  isCreatingSession: boolean
  sessionError: string
}

type Narrative = { title: string }
type Chapter = { title: string; narratives: Narrative[] }

const chapters: Chapter[] = [
  { title: 'Chapter 1: Self-knowledge and emotional awareness', narratives: [
    { title: 'Who am I? Personal and social identity' }, { title: 'My emotions have names' }, { title: 'The emotional thermometer' }, { title: 'Body and emotion' },
    { title: 'My strengths and areas for growth' }, { title: 'Inner dialogue' }, { title: 'Self-esteem: loving myself without perfection' }, { title: 'My personal story' },
  ] },
  { title: 'Chapter 2: Emotional self-regulation', narratives: [
    { title: 'The emotion traffic light' }, { title: 'Breathing and calm' }, { title: 'Impulsiveness and its consequences' }, { title: 'Tolerating frustration' },
    { title: 'Managing stress and anxiety' }, { title: 'The power of the pause' }, { title: 'Healthy strategies to regulate what I feel' }, { title: 'Self-control and freedom' },
  ] },
  { title: 'Chapter 3: Empathy and social perspective', narratives: [
    { title: 'What is empathy?' }, { title: 'Cognitive and emotional empathy' }, { title: 'Active listening' }, { title: 'Prejudice and stereotypes' },
    { title: 'Diversity as a strength' }, { title: 'Empathy in action' }, { title: 'Compassion: from feeling to acting' }, { title: 'Digital empathy' },
  ] },
  { title: 'Chapter 4: Communication and relationship skills', narratives: [
    { title: 'Assertive communication' }, { title: 'Verbal and non-verbal language' }, { title: 'The art of conversation' }, { title: 'Conflict resolution' },
    { title: 'Negotiation and fair agreements' }, { title: 'Constructive criticism' }, { title: 'Building trust' }, { title: 'Healthy relationships' },
  ] },
  { title: 'Chapter 5: Collaboration and teamwork', narratives: [
    { title: 'What is teamwork?' }, { title: 'Roles and responsibilities' }, { title: 'Cooperation vs. competition' }, { title: 'Positive leadership' },
    { title: 'Making decisions together' }, { title: 'Handling disagreements' }, { title: 'Shared goals' }, { title: 'Celebrating the team’s achievements' },
  ] },
  { title: 'Chapter 6: Responsible decision-making', narratives: [
    { title: 'Everyday decisions' }, { title: 'The decision-making process' }, { title: 'Short- and long-term consequences' }, { title: 'Social influence and peer pressure' },
    { title: 'Values as a compass' }, { title: 'Ethical decisions' }, { title: 'Learning from mistakes' }, { title: 'Responsibility for my choices' },
  ] },
  { title: 'Chapter 7: Values, principles and personal ethics', narratives: [
    { title: 'What are values?' }, { title: 'Honesty and trust' }, { title: 'Justice' }, { title: 'Respect and dignity' },
    { title: 'Responsibility and commitment' }, { title: 'Solidarity' }, { title: 'Integrity' }, { title: 'My personal code of ethics' },
  ] },
  { title: 'Chapter 8: Ethics in relationships and living together', narratives: [
    { title: 'Living together peacefully' }, { title: 'Human rights' }, { title: 'Equality and non-discrimination' }, { title: 'Freedom with responsibility' },
    { title: 'Restorative justice' }, { title: 'Culture of peace' }, { title: 'Active citizenship' }, { title: 'Ethics of care' },
  ] },
  { title: 'Chapter 9: Ethics in the digital and global world', narratives: [
    { title: 'Digital citizenship' }, { title: 'Digital footprint' }, { title: 'Truth and misinformation' }, { title: 'Respect on social media' },
    { title: 'Privacy and personal data' }, { title: 'Responsible consumption and environmental ethics' }, { title: 'Global ethics' }, { title: 'Technology with values' },
  ] },
  { title: 'Chapter 10: Life plan and ethical commitment', narratives: [
    { title: 'My dreams and goals' }, { title: 'Life plan' }, { title: 'Life skills' }, { title: 'Ethics and career plans' },
    { title: 'Contributing to my community' }, { title: 'Resilience' }, { title: 'Global citizenship' }, { title: 'My ethical commitment' },
  ] },
]

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

function NarrativeCover({ source, title }: { source?: string; title: string }) {
  if (!source) return null
  return <img src={source} alt={`Cover of ${title}`} onError={(event) => { event.currentTarget.style.display = 'none' }} className="absolute inset-0 h-full w-full object-cover" />
}

export default function CatalogScreen({ onNarrativeSelect, onOpenReports, teacherEmail, onLogout, isCreatingSession, sessionError }: CatalogScreenProps) {
  const covers: Record<string, string> = {
    '1': '/ImagenesCapitulos/Capitulo%201/cover%20-%20copia.png',
    '2': '/ImagenesCapitulos/Capitulo%202/cover2.jpg',
    '3': '/ImagenesCapitulos/Capitulo%203/cover3.jpg',
    '4': '/ImagenesCapitulos/Capitulo%204/cover4.jpg',
    '5': '/ImagenesCapitulos/Capitulo%205/cover5.jpg',
    '6': '/ImagenesCapitulos/Capitulo%206/cover6.jpg',
    '7': '/ImagenesCapitulos/Capitulo%207/cover7.jpg',
    '8': '/ImagenesCapitulos/Capitulo%208/cover8.jpg',
    '9': '/ImagenesCapitulos/Capitulo%209/cover9.jpg',
    '10': '/ImagenesCapitulos/Capitulo%2010/cover10.jpg',
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-950">
      <header className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <span className="text-lg font-bold tracking-tight text-red-700">Serena</span>
        <div className="flex items-center gap-3"><button type="button" onClick={onOpenReports} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">Past reports</button><span className="hidden text-xs text-gray-600 sm:inline">{teacherEmail}</span><button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><UserIcon /></button></div>
      </header>

      <div className="space-y-10 px-4 py-9 sm:px-6 lg:px-8">
        {sessionError && <p role="alert" className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sessionError}</p>}
        {isCreatingSession && <p role="status" className="mx-auto max-w-2xl text-center text-sm text-gray-600">Creating the session…</p>}
        {chapters.map((chapter, chapterIndex) => (
          <section key={chapter.title} aria-labelledby={`chapter-${chapterIndex}`}>
            <h1 id={`chapter-${chapterIndex}`} className="mb-4 text-xl font-extrabold tracking-tight text-gray-950">{chapter.title}</h1>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {chapter.narratives.map((narrative, narrativeIndex) => {
                const globalNarrative = chapterIndex * 8 + narrativeIndex + 1
                const isFirstNarrative = globalNarrative === 1
                const card = <><div className="aspect-video bg-gray-800" /><NarrativeCover source={covers[String(chapterIndex + 1)]} title={narrative.title} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-10"><p className="text-xs font-semibold text-red-500">Chapter {chapterIndex + 1}</p><p className="mt-1 text-sm font-bold leading-tight text-white">Story {narrativeIndex + 1}: {narrative.title}</p></div></>
                return isFirstNarrative ? <button key={narrative.title} type="button" disabled={isCreatingSession} onClick={onNarrativeSelect} aria-busy={isCreatingSession} className="relative overflow-hidden rounded-xl text-left shadow-md transition duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{card}</button> : <article key={narrative.title} className="relative overflow-hidden rounded-xl shadow-md">{card}</article>
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
