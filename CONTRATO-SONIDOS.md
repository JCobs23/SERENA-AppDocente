# Contrato de sonidos de SERENA

Historias de usuario 6.2.2, 11.2.2, 11.5.1, 11.5.4 y 10.5.2 (responsable: Edwin). Todos los sonidos son tonos generados por código, así que no hay archivos de audio que copiar ni licencias que revisar. Los niveles se definen en un solo lugar de cada aplicación:

- Web docente: `frontend/src/lib/sounds.ts` (constantes `SOUNDS` y `AMBIENT`).
- Tablet: `Assets/Scripts/StudentProgressView.cs` (`PlayChime`) y `NarrativeStageView.cs` (`PlayConfirmationTone`).

## Sonidos

| Nombre | Dónde suena | Notas | Duración | Nivel (pico) | Se puede apagar |
| --- | --- | --- | --- | --- | --- |
| `decision-confirm` | Panel de decisión final del docente, al confirmar el servidor | 660 Hz | 0,16 s | 0,045 | No (es la confirmación de la acción) |
| `response-received` | Panel de supervisión, cuando un estudiante responde | 523 Hz | 0,12 s | 0,018 | Sí, botón «Sonido» del panel |
| `summary-open` | Al abrir el resumen grupal | 392 Hz y 523 Hz | 0,5 s | 0,025 | Sí, botón «Sonidos» del resumen |
| `summary-section` | Resumen: cambiar de filtro, abrir un detalle o volver | 587 Hz | 0,1 s | 0,02 | Sí, botón «Sonidos» del resumen |
| Ambiente del resumen | Mientras el resumen está abierto | Acorde 196, 247 y 294 Hz | Continuo, entra y sale en 2,5 s | 0,012 | Apagado por defecto, botón «Ambiente» |
| `SerenaStageCompleted` (tablet) | Al completar una etapa | 523 Hz y 784 Hz | 0,32 s | 0,06 × 0,2 | No suena si la tablet está reproduciendo el video de la etapa 4 |
| `SerenaDecisionConfirmed` (tablet) | Cuando el servidor confirma una respuesta | 740 Hz | 0,1 s | 0,08 × 0,25 | No |

Las preferencias de encendido o apagado se guardan en el navegador del docente (`localStorage`, claves `serena.sound.supervision`, `serena.sound.summary` y `serena.sound.ambient`).

## Señales visuales moderadas

- Supervisión: la fila del estudiante que responde se resalta con un verde suave que se desvanece en 1,5 s; la respuesta mayoritaria se marca con un contorno gris claro en lugar de verde intenso; la paleta de barras usa colores de saturación media.
- Resumen: los bloques aparecen de uno en uno cada 150 ms con un desplazamiento de 8 px; las barras de votos se llenan en 1 s; colores neutros (gris piedra) en botones e indicadores; sin rojo para resultados, para no sugerir que una opción es mala.
- Todas las animaciones se desactivan si el sistema operativo tiene activada la opción de reducir movimiento.

## Pendiente de validar en el aula

- [ ] Volumen de los parlantes del computador del aula con los niveles anteriores.
- [ ] Que el sonido de supervisión no se escuche desde el fondo del salón.
- [ ] Opinión de la docente sobre el ambiente sonoro del resumen y el mensaje de cierre.
