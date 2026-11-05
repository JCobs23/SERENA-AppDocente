type IntroductionScreenProps = {
  onReturnToChapters: () => void
}

export default function IntroductionScreen({ onReturnToChapters }: IntroductionScreenProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-6 text-center text-gray-950">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-600">Narrativa interactiva</p>
        <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">INTRODUCCION</h1>
        <button type="button" onClick={onReturnToChapters} className="mt-10 rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:border-red-200 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Volver a capítulos</button>
      </section>
    </main>
  )
}
