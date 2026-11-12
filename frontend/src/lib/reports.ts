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
