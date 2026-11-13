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
  { title: 'Chapter 1: Self-Knowledge and Emotional Awareness', narratives: [
    { title: 'Who Am I? Personal and Social Identity' }, { title: 'My Emotions Have Names' }, { title: 'The Emotion Thermometer' }, { title: 'Body and Emotion' },
    { title: 'My Strengths and Areas for Growth' }, { title: 'Inner Dialogue' }, { title: 'Self-Esteem: Accepting Myself Without Perfection' }, { title: 'My Personal Story' },
  ] },
  { title: 'Chapter 2: Emotional Self-Regulation', narratives: [
    { title: 'The Emotional Traffic Light' }, { title: 'Breathing and Calm' }, { title: 'Impulsivity and Its Consequences' }, { title: 'Tolerance for Frustration' },
    { title: 'Managing Stress and Anxiety' }, { title: 'The Power of a Pause' }, { title: 'Healthy Strategies for Managing Emotions' }, { title: 'Self-Control and Freedom' },
  ] },
  { title: 'Chapter 3: Empathy and Social Perspective', narratives: [
    { title: 'What Is Empathy?' }, { title: 'Cognitive and Emotional Empathy' }, { title: 'Active Listening' }, { title: 'Bias and Stereotypes' },
    { title: 'The Value of Diversity' }, { title: 'Empathy in Action' }, { title: 'Compassion: From Feeling to Action' }, { title: 'Digital Empathy' },
  ] },
  { title: 'Chapter 4: Communication and Relationship Skills', narratives: [
    { title: 'Assertive Communication' }, { title: 'Verbal and Nonverbal Communication' }, { title: 'The Art of Conversation' }, { title: 'Conflict Resolution' },
    { title: 'Negotiation and Fair Agreements' }, { title: 'Constructive Feedback' }, { title: 'Building Trust' }, { title: 'Healthy Relationships' },
  ] },
  { title: 'Chapter 5: Collaboration and Teamwork', narratives: [
    { title: 'What Does Teamwork Mean?' }, { title: 'Roles and Responsibilities' }, { title: 'Cooperation vs. Competition' }, { title: 'Positive Leadership' },
    { title: 'Collaborative Decision-Making' }, { title: 'Managing Disagreements' }, { title: 'Shared Goals' }, { title: 'Celebrating Team Achievements' },
  ] },
  { title: 'Chapter 6: Responsible Decision-Making', narratives: [
    { title: 'Everyday Decisions' }, { title: 'The Decision-Making Process' }, { title: 'Short- and Long-Term Consequences' }, { title: 'Social Influence and Peer Pressure' },
    { title: 'Values as a Compass' }, { title: 'Ethical Decisions' }, { title: 'Learning from Mistakes' }, { title: 'Taking Responsibility for My Choices' },
  ] },
  { title: 'Chapter 7: Values, Principles, and Personal Ethics', narratives: [
    { title: 'What Are Values?' }, { title: 'Honesty and Trust' }, { title: 'Justice' }, { title: 'Respect and Dignity' },
    { title: 'Responsibility and Commitment' }, { title: 'Solidarity' }, { title: 'Integrity' }, { title: 'My Personal Code of Ethics' },
  ] },
  { title: 'Chapter 8: Ethics and Healthy Relationships', narratives: [
    { title: 'Peaceful Coexistence' }, { title: 'Human Rights' }, { title: 'Equality and Non-Discrimination' }, { title: 'Freedom with Responsibility' },
    { title: 'Restorative Justice' }, { title: 'A Culture of Peace' }, { title: 'Active Citizenship' }, { title: 'Ethics of Care' },
  ] },
  { title: 'Chapter 9: Ethics in a Digital and Global World', narratives: [
    { title: 'Digital Citizenship' }, { title: 'Digital Footprints' }, { title: 'Truth and Misinformation' }, { title: 'Respect on Social Media' },
    { title: 'Privacy and Personal Data' }, { title: 'Responsible Consumption and Environmental Ethics' }, { title: 'Global Ethics' }, { title: 'Technology Guided by Values' },
  ] },
  { title: 'Chapter 10: Life Plans and Ethical Commitment', narratives: [
    { title: 'My Dreams and Goals' }, { title: 'A Plan for My Life' }, { title: 'Life Skills' }, { title: 'Ethics and Career Plans' },
    { title: 'Contributing to My Community' }, { title: 'Resilience' }, { title: 'Global Citizenship' }, { title: 'My Ethical Commitment' },
  ] },
]

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

function NarrativeCover({ source, title }: { source?: string; title: string }) {
  if (!source) return null
  return <img src={source} alt={`Cover image for ${title}`} onError={(event) => { event.currentTarget.style.display = 'none' }} className="absolute inset-0 h-full w-full object-cover" />
}

export default function CatalogScreen({ onNarrativeSelect, teacherEmail, onLogout, isCreatingSession, sessionError }: CatalogScreenProps) {
  const [covers, setCovers] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    // In development, Vite proxies this route to the cover server, so the
    // catalog also works when Vite chooses a port other than 5173.
    fetch(import.meta.env.VITE_MEDIA_SERVER_URL ?? '/covers-manifest')
      .then(async (response) => response.ok ? response.json() as Promise<{ covers: Record<string, string> }> : Promise.reject())
      .then((manifest) => { if (!cancelled) setCovers(manifest.covers) })
      .catch(() => { /* Keep the dark card backgrounds when covers are unavailable. */ })

    return () => { cancelled = true }
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 text-gray-950">
      <header className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <span className="text-lg font-bold tracking-tight text-red-700">Serena</span>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-gray-600 sm:inline">{teacherEmail}</span><button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><UserIcon /></button></div>
      </header>

      <div className="space-y-10 px-4 py-9 sm:px-6 lg:px-8">
        {sessionError && <p role="alert" className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sessionError}</p>}
        {isCreatingSession && <p role="status" className="mx-auto max-w-2xl text-center text-sm text-gray-600">Creating session…</p>}
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
