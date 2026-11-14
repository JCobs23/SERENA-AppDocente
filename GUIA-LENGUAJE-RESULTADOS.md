# Guía de lenguaje de los resultados

Historias de usuario 11.4.2, 11.5.2 y 11.5.3. Los textos que ve el docente en el resumen grupal salen de un solo archivo: `frontend/src/lib/summaryTexts.ts` (el contrato de textos). Para cambiar una frase hay que editarla ahí, no en los componentes.

> **Estado:** los textos son una propuesta del equipo. Todavía falta validarlos con la docente del Colegio Bilingüe Guillermo Ponce de León.

## Reglas

| Regla | En lugar de | Escribir |
| --- | --- | --- |
| Hablar del grupo, no de personas | «Algunos estudiantes difundieron el rumor» | «La opción más elegida fue…» |
| No calificar las respuestas | «Reflexiones positivas», «decisión correcta» | «Respuestas "sí"», «opción más elegida» |
| Preguntar para abrir el diálogo | «¿Por qué hicieron eso?» | «¿Qué hizo que esta opción pareciera la más adecuada?» |
| Presentar la mejora como un tema para conversar | «El grupo falla en regular sus emociones» | «Puede ser útil conversar sobre cómo cuidarse entre compañeros» |
| Advertir cuando hay pocas respuestas | — | «Hay pocas respuestas: los porcentajes pueden no representar a todo el grupo» |
| Colores neutros | «No» en rojo | «No» en gris; el rojo se reserva para acciones |

## Dónde aparece cada texto

| Sección del resumen | Constante o función en `summaryTexts.ts` | H.U. |
| --- | --- | --- |
| Nota de privacidad y etiquetas | `neutralLabels` | 11.4.2 |
| «Para conversar en clase» (resumen y detalle) | `reflectiveMessagesByDecision`, `reflectiveMessagesByEmotion`, `reflectiveMessagesByQuestion`, `generalReflectiveMessages` | 11.5.2 |
| «Aprendizaje del grupo» | `learningText`, `diversityText` | 11.5.3 |
| «Oportunidades de mejora» | `opportunityText` | 11.5.3 |
| Filtro por tema | `topics`, `topicByEmotion`, `topicByDecision`, `reflectionQuestions[].topic` | 11.3.3 |

## Checklist para validar con la docente

- [ ] Ningún texto nombra ni permite identificar a un estudiante.
- [ ] Ningún texto califica una decisión como buena o mala.
- [ ] Las preguntas de «Para conversar en clase» sirven para la edad del grupo.
- [ ] Los temas del filtro coinciden con los que se trabajan en clase.
- [ ] Las frases de oportunidades de mejora no incomodan a los estudiantes si se proyectan.
