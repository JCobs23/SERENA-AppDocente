# Contrato de estado de sesión SERENA

Este documento describe el estado compartido entre Serena.Api, la aplicación docente, la proyección y las tablets. La API es la fuente de verdad; los clientes no deben inventar ni conservar un estado divergente después de recibir una revisión nueva.

## Fuentes y transporte

- `GET /api/sessions/{code}` entrega una instantánea pública para las tablets. No contiene nombres ni identificadores de estudiantes; solo cantidades y agregados.
- `GET /api/sessions/{code}/stream` usa WebSocket autenticado por la cookie docente. Al conectar y reconectar envía primero `snapshot` (lista de asistencia para la sala docente) y después `narrative-state`.
- Los cambios aceptados por la API incrementan la revisión y se publican a las conexiones de docentes y proyección. Las tablets consultan la instantánea REST y envían su interacción por los endpoints `/students/{studentId}/...`.
- Cada operación POST de sesión persistida actualiza SQLite. El reporte final conserva solo agregados y no depende de la vida de la sesión activa.

## Evento WebSocket `narrative-state`

El objeto `state` contiene estos campos JSON en camelCase:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `narrativeStarted` | boolean | La experiencia fue iniciada. |
| `stage` | integer | Etapa activa: 0 introducción; 1–5 narrativa y reflexión/cierre. |
| `stageLabel`, `stageDescription` | string | Texto localizado para las interfaces. |
| `revision` | integer | Versión monotónica del estado narrativo. |
| `mediaPaused`, `mediaPositionSeconds`, `mediaRevision`, `mediaCommand`, `volumePercent` | boolean/number/string | Estado compartido del video y orden más reciente. |
| `connectedStudents`, `participantCount`, `readyStudents`, `introCompletedStudents` | integer | Conteos de asistencia, nunca identidades. |
| `emotionCounts`, `decisionCounts` | object<string, integer> | Respuestas agregadas por opción. |
| `advanceMode` | `automatic` o `vote` | Modo elegido por el docente. |
| `votingOpen` | boolean | La votación está disponible. |
| `continueVotes`, `alternativeVotes` | integer | Conteo agregado de votos. |
| `finalDecision` | `continue`, `vote` o `null` | Decisión final del docente. |
| `voteRound` | integer | Identificador creciente de ronda para no reutilizar votos anteriores. |

## Reglas de sincronización

1. La API valida cada cambio y lo guarda antes de responder.
2. Una interfaz aplica el último estado válido por `revision`; no combina campos de revisiones distintas.
3. Tras perder conexión, la sala vuelve a abrir el WebSocket. La API envía una instantánea actual y el estado narrativo completo, por lo que el cliente no depende de haber recibido eventos anteriores.
4. El cambio de modo final responde con el estado confirmado. La interfaz docente muestra la confirmación al aceptar el servidor y conserva la selección anterior si la operación falla.
5. `GET /api/sessions/{code}` y los endpoints `/api/reports...` no devuelven nombres ni IDs de estudiantes. Los endpoints de asistencia/interacción para supervisión docente en vivo son distintos y no se usan para generar, listar o descargar reportes.

## Compatibilidad entre equipos

Los cambios del contrato se deben comunicar a quienes mantienen la app de estudiante, la proyección y la sala docente. Agregar campos opcionales es compatible; cambiar el significado o tipo de un campo existente requiere actualizar todos los clientes antes de desplegar la API.
