// Contrato de textos del resumen grupal (H.U. 11.4.2, 11.5.2 y 11.5.3).
// Todos los textos que el resumen muestra sobre los resultados salen de este archivo para
// mantener un lenguaje neutral y respetuoso. Guía completa: GUIA-LENGUAJE-RESULTADOS.md.
//
// Reglas de redacción:
// 1. Describir lo que eligió el grupo, nunca a estudiantes concretos ("el grupo", "algunas personas").
// 2. No calificar las respuestas como buenas, malas, positivas o negativas.
// 3. Formular preguntas abiertas que inviten al diálogo, no a justificarse.
// 4. Presentar las oportunidades de mejora como temas para conversar, no como fallas.
// 5. Con pocas respuestas, recordar que los porcentajes pueden no representar al grupo.

export type ResultKind = 'emotion' | 'decision' | 'reflection'

export const topics = [
  'Communication and dialogue',
  'Rumors and exposure',
  'Bystander role',
  'Emotional recognition',
  'Belonging and well-being',
  'Personal values',
  'Empathy and coexistence',
] as const

export type Topic = (typeof topics)[number]

export const kindLabels: Record<ResultKind, string> = {
  emotion: 'Emotions',
  decision: 'Decisions',
  reflection: 'Reflection',
}

// Tema trabajado por cada opción. Se usa para el filtro por tema (H.U. 11.3.3).
export const topicByEmotion: Record<string, Topic> = {
  Curious: 'Emotional recognition',
  Neutral: 'Emotional recognition',
  Confused: 'Emotional recognition',
  Uncomfortable: 'Belonging and well-being',
  'Fear of exclusion': 'Belonging and well-being',
}

export const topicByDecision: Record<string, Topic> = {
  'Talk directly': 'Communication and dialogue',
  'Change the subject': 'Communication and dialogue',
  'Spread the rumor': 'Rumors and exposure',
  'Avoid getting involved': 'Bystander role',
}

export const reflectionQuestions = [
  { question: 1, text: 'Was this decision in line with your values?', topic: 'Personal values' as Topic },
  { question: 2, text: 'Would you make the same decision in real life?', topic: 'Personal values' as Topic },
  { question: 3, text: 'Did you think about the impact on other people?', topic: 'Empathy and coexistence' as Topic },
  { question: 4, text: 'Are you comfortable with this outcome?', topic: 'Belonging and well-being' as Topic },
]

export const neutralLabels = {
  privacyNote: 'This summary shows aggregated group results. It does not include student names or identifiers.',
  yesAnswers: '“Yes” answers',
  yesAnswersDetail: (yes: number, answered: number) => `${yes} of ${answered} answers`,
  fewResponses: 'There are only a few responses: the percentages may not represent the whole group.',
  noResults: 'There are no results for the selected filters. Try another result type or another topic.',
  noResponsesForResult: 'Nobody chose this option in the session.',
  oldReport: 'This report was created before the extended detail existed: only the group totals are shown.',
  openDetail: 'View detail',
  backToSummary: 'Back to the overall summary',
}

// H.U. 11.5.2: preguntas para conversar en clase según lo que eligió el grupo.
export const reflectiveMessagesByDecision: Record<string, string[]> = {
  'Talk directly': [
    'What does it take for a difficult conversation to feel safe for everyone?',
    'How can we talk about what happened without anyone feeling singled out?',
  ],
  'Avoid getting involved': [
    'What makes us sometimes prefer not to step in?',
    'What small actions could help without exposing yourself too much?',
  ],
  'Spread the rumor': [
    'How does a situation change when the information reaches more people?',
    'How might someone feel when they find out people are talking about them?',
  ],
  'Change the subject': [
    'When does changing the subject help, and when does it leave something unresolved?',
    'What other way could calm the situation down and then come back to it?',
  ],
}

export const reflectiveMessagesByEmotion: Record<string, string> = {
  Curious: 'What questions came up when you saw the situation?',
  Neutral: 'What would make a situation like this feel closer to you?',
  Confused: 'What information was missing to better understand what was happening?',
  Uncomfortable: 'Which part of the situation felt uncomfortable, and why?',
  'Fear of exclusion': 'What can a group do so that nobody feels left out?',
}

export const reflectiveMessagesByQuestion: Record<number, string> = {
  1: 'Which values came up when making the decision?',
  2: 'What is the difference between deciding in a story and deciding in real life?',
  3: 'Who was affected by the decision, and how?',
  4: 'What would you change to feel more comfortable with the outcome?',
}

export const generalReflectiveMessages = [
  'Each answer shows a different way of seeing the situation; there is no single right answer.',
  'What did we learn as a group by comparing our decisions?',
]

// H.U. 11.5.3: aprendizajes y oportunidades de mejora en lenguaje neutral.
export function learningText(leadingDecision: [string, number] | undefined, total: number): string {
  if (!leadingDecision || !total) return 'There are no decisions recorded yet to identify something the group learned.'
  const percent = Math.round(leadingDecision[1] / total * 100)
  return `The most chosen option was “${leadingDecision[0]}” (${percent}% of the group). It is a starting point to talk about what made it seem the most suitable.`
}

export function diversityText(decisionKinds: number): string {
  if (decisionKinds <= 1) return 'The group agreed on a single decision; it is worth exploring which other options would have been possible.'
  return `The group chose ${decisionKinds} different decisions: there is a variety of points of view to share.`
}

export function opportunityText(discomfortCount: number, total: number, exploredDecisions: string[]): string {
  const parts: string[] = []
  if (discomfortCount && total) {
    const percent = Math.round(discomfortCount / total * 100)
    parts.push(`${percent}% of the group named discomfort or fear of exclusion; it may help to talk about how classmates can look out for each other in situations like this.`)
  }
  if (exploredDecisions.length)
    parts.push(`The group explored alternatives to “${exploredDecisions.join('”, “')}”; comparing both rounds can enrich the conversation.`)
  if (!parts.length) parts.push('An opportunity for the next session is to ask the group for examples of similar situations around them.')
  return parts.join(' ')
}

// Reportes guardados antes de la traducción al inglés: sus claves siguen en español.
const legacyValues: Record<string, string> = {
  Curioso: 'Curious',
  'Miedo a la exclusión': 'Fear of exclusion',
  'Incómodo': 'Uncomfortable',
  Confundido: 'Confused',
  'Dialogar directamente': 'Talk directly',
  'Evitar involucrarse': 'Avoid getting involved',
  'Difundir el rumor': 'Spread the rumor',
  'Cambiar el tema': 'Change the subject',
}

export const toEnglishValue = (value: string) => legacyValues[value] ?? value
