// Contrato de sonidos de la aplicación docente (H.U. 6.2.2, 11.2.2, 11.5.1 y 11.5.4).
// Todos los sonidos se generan con Web Audio (no hay archivos de audio que distribuir) y
// sus niveles están definidos aquí para mantener una intensidad moderada en el aula.
// Documentación: CONTRATO-SONIDOS.md.

export type SoundName = 'response-received' | 'summary-section' | 'summary-open'
export type SoundScope = 'supervision' | 'summary' | 'ambient'

type Note = { frequency: number; start: number; duration: number }
type SoundSpec = { gain: number; notes: Note[]; type: OscillatorType }

// gain = pico de la envolvente (0 a 1). Como referencia, el tono de confirmación de la
// decisión final (FinalDecisionPanel) usa 0.045; estos sonidos quedan por debajo.
export const SOUNDS: Record<SoundName, SoundSpec> = {
  // Supervisión: una nota corta y grave cuando llega una respuesta nueva.
  'response-received': { gain: 0.018, type: 'sine', notes: [{ frequency: 523.25, start: 0, duration: 0.12 }] },
  // Resumen: cambio de sección, filtro o detalle.
  'summary-section': { gain: 0.02, type: 'sine', notes: [{ frequency: 587.33, start: 0, duration: 0.1 }] },
  // Resumen: apertura del panel de datos (dos notas ascendentes, suaves).
  'summary-open': {
    gain: 0.025, type: 'sine', notes: [
      { frequency: 392, start: 0, duration: 0.22 },
      { frequency: 523.25, start: 0.18, duration: 0.3 },
    ],
  },
}

// Ambiente sonoro opcional del resumen: acorde suave con variación lenta (desactivado por defecto).
export const AMBIENT = { gain: 0.012, frequencies: [196, 246.94, 293.66], fadeSeconds: 2.5 }

const DEFAULTS: Record<SoundScope, boolean> = { supervision: true, summary: true, ambient: false }
const storageKey = (scope: SoundScope) => `serena.sound.${scope}`

let context: AudioContext | null = null
let ambient: { gain: GainNode; oscillators: OscillatorNode[] } | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!context) context = new window.AudioContext()
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

export function isSoundEnabled(scope: SoundScope): boolean {
  try {
    const stored = window.localStorage.getItem(storageKey(scope))
    return stored === null ? DEFAULTS[scope] : stored === 'on'
  } catch {
    return DEFAULTS[scope]
  }
}

export function setSoundEnabled(scope: SoundScope, enabled: boolean) {
  try { window.localStorage.setItem(storageKey(scope), enabled ? 'on' : 'off') } catch { /* sin almacenamiento */ }
}

export function playSound(name: SoundName, scope: SoundScope) {
  if (!isSoundEnabled(scope)) return
  const ctx = audio()
  if (!ctx) return
  const spec = SOUNDS[name]
  const now = ctx.currentTime
  for (const note of spec.notes) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = now + note.start
    oscillator.type = spec.type
    oscillator.frequency.setValueAtTime(note.frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + note.duration + 0.02)
  }
}

export function startAmbient() {
  const ctx = audio()
  if (!ctx || ambient) return
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(AMBIENT.gain, ctx.currentTime + AMBIENT.fadeSeconds)
  gain.connect(ctx.destination)
  const oscillators = AMBIENT.frequencies.map((frequency, index) => {
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
    // Variación muy lenta de afinación para que el acorde "respire" sin llamar la atención.
    oscillator.detune.setValueAtTime(0, ctx.currentTime)
    oscillator.detune.linearRampToValueAtTime(index % 2 ? 6 : -6, ctx.currentTime + 8)
    oscillator.connect(gain)
    oscillator.start()
    return oscillator
  })
  ambient = { gain, oscillators }
}

export function stopAmbient() {
  if (!ambient || !context) return
  const { gain, oscillators } = ambient
  ambient = null
  const end = context.currentTime + AMBIENT.fadeSeconds
  gain.gain.cancelScheduledValues(context.currentTime)
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  oscillators.forEach((oscillator) => oscillator.stop(end + 0.05))
}
