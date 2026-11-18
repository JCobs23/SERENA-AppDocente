import { toEnglishValue } from './summaryTexts'

export type SessionReport = {
  reportId: string
  sessionCode: string
  createdAt: string
  status: 'completed' | 'partial'
  participantCount: number
  connectedParticipants: number
  stageReached: number
  advanceMode: 'automatic' | 'vote'
  finalDecision: string | null
  emotionCounts: Record<string, number>
  decisionCounts: Record<string, number>
  continueVotes: number
  alternativeVotes: number
  reflections: { question: number; yes: number; no: number; unanswered: number }[]
  // Opcionales: no existen en reportes guardados antes del detalle ampliado (H.U. 11.3.2).
  responses?: AnonymousResponse[] | null
  exploredDecisions?: string[] | null
}

// Respuesta anónima de un estudiante: sin nombre ni identificador.
export type AnonymousResponse = {
  emotion: string | null
  decision: string | null
  reflection: string | null
}

export type SessionReportListItem = {
  reportId: string
  sessionCode: string
  createdAt: string
  status: 'completed' | 'partial'
  participantCount: number
  sentTo: string | null
  sentAt: string | null
}

function translateCounts(counts: Record<string, number>) {
  const result: Record<string, number> = {}
  for (const [value, count] of Object.entries(counts)) {
    const key = toEnglishValue(value)
    result[key] = (result[key] ?? 0) + count
  }
  return result
}

const translateValue = (value: string | null) => (value === null ? null : toEnglishValue(value))

// Reportes guardados antes de la traducción: se muestran con los nombres en inglés.
export function normalizeReport(report: SessionReport): SessionReport {
  return {
    ...report,
    emotionCounts: translateCounts(report.emotionCounts),
    decisionCounts: translateCounts(report.decisionCounts),
    responses: report.responses?.map((response) => ({
      ...response,
      emotion: translateValue(response.emotion),
      decision: translateValue(response.decision),
    })),
    exploredDecisions: report.exploredDecisions?.map(toEnglishValue),
  }
}
