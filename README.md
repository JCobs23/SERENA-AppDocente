# SERENA

SERENA es un sistema multimedia para el aprendizaje social, emocional y ético (programa SEE Learning) en el aula de bachillerato. El docente proyecta una historia y cada estudiante, desde su tablet, reconoce una emoción, toma una decisión y ve su consecuencia. Al final, el grupo vota cómo continuar, reflexiona y el docente recibe un reporte anónimo en PDF.

Proyecto del curso Diseño Multimedia 2, Universidad Autónoma de Occidente (2026), desarrollado por RepitisTeam para el Colegio Bilingüe Guillermo Ponce de León (Fundación Levapan).

| Integrante | Área principal |
| --- | --- |
| Javier Lain Valero | Servidor, sincronización, votación, reportes y arranque |
| Johan Sebastian Cobo Uran | Aplicación web del docente, supervisión y resumen |
| Victor Manuel Salazar Chaparro | Escena, cámara, videos de consecuencia y estructura del resumen |
| Bryan Andres Peñaranda Soto | Interfaz táctil del estudiante, reflexión y red del aula |
| Edwin David Correa Cifuentes | Sonido, háptica, progreso del estudiante y ambiente del cierre |

## Repositorios

El sistema está repartido en dos repositorios:

- **SERENA-AppDocente** (este repositorio): servidor del aula, aplicación web del docente, proyección y lanzador.
- **[SERENA---AppEstudiante](https://github.com/JCobs23/SERENA---AppEstudiante)**: aplicación Unity para las tablets Android de los estudiantes.

## Cómo funciona

SERENA funciona dentro de la red local del aula, sin depender de internet. El portátil del docente ejecuta el servidor; el navegador del docente y las tablets se conectan a él por el wifi del salón.

```text
 Tablet (Unity, Android)                Portátil del docente
 ─────────────────────                  ─────────────────────────────────────────────
 Ingreso, narrativa,     HTTP :5080     Serena.Api (ASP.NET Core, .NET 10)
 emoción, decisión,  ─── REST/JSON ───▶ · reglas de la sesión y validación
 votación, reflexión     estado 0,5 s   · SQLite (sesiones, respuestas, reportes)
                         latido 3 s     · PDF del reporte y envío SMTP
                                              ▲
                                              │ HTTPS :5081 + WebSocket
                                              ▼
                                        Web del docente (React + TypeScript + Vite)
                                        · panel privado de supervisión
                                        · proyección del aula (solo totales)
                                        · resumen e historial de reportes
```

- Las tablets consultan el estado de la sesión cada 0,5 s y envían un latido cada 3 s. Si pasan 15 s sin latido, el estudiante aparece desconectado; al volver conserva su identidad y sus respuestas.
- El panel del docente recibe los cambios en vivo por un WebSocket autenticado (`/api/sessions/{code}/stream`). La proyección consulta el estado cada 0,7 s.
- La API es la única fuente de verdad: valida cada operación, la guarda en SQLite y publica una revisión nueva del estado. El contrato está en [CONTRATO-ESTADO-SESION.md](CONTRATO-ESTADO-SESION.md).
- La proyección y los reportes nunca muestran nombres ni identificadores de estudiantes; los nombres solo aparecen en el panel privado del docente.

### La experiencia en cinco etapas

1. **Historia inicial.** Cuando todas las tablets terminan la introducción, el video se proyecta y el docente controla pausa, ±5 s y volumen.
2. **Reconocer la emoción.** Cada estudiante elige en su tablet la emoción que identifica.
3. **Tomar una decisión.** Cada estudiante decide en privado y el docente ve la distribución en vivo.
4. **Ver la consecuencia.** Cada tablet reproduce el video de la decisión que eligió ese estudiante y muestra un mensaje breve y neutral.
5. **Reflexionar.** El docente continúa la historia o abre una votación; el grupo puede explorar otra decisión (las opciones más votadas quedan bloqueadas) y cada estudiante responde cuatro preguntas de reflexión.

Al terminar, el sistema genera un reporte anónimo con participación, emociones, decisiones y reflexiones, que el docente puede descargar en PDF o enviar a un correo autorizado.

## Estructura del repositorio

```text
SERENA-AppDocente/
├─ Iniciar Serena.cmd ........ inicio con un único acceso (doble clic)
├─ launcher/ ................. Serena-Docente.exe: inicia y supervisa los servicios
├─ Serena.Api/ ............... servidor del aula (ASP.NET Core, .NET 10)
│  ├─ Program.cs ............. endpoints REST, WebSocket y reglas de la sesión
│  ├─ SessionReports.cs ...... reporte del grupo, PDF y envío por correo
│  ├─ Data/SerenaDatabase.cs . persistencia en SQLite (Microsoft.Data.Sqlite)
│  ├─ create-teacher.ps1 ..... crea una cuenta docente (hash PBKDF2)
│  └─ seed-demo-teachers.ps1 . cuentas de prueba
├─ frontend/ ................. web del docente (React 19, TypeScript, Vite, Tailwind)
│  └─ src/components/ ........ Login, Catálogo, Sala de espera, Supervisión,
│                              Decisión final, Proyección, Resumen e Historial
├─ backend/ .................. servicio auxiliar Node/Socket.IO
└─ *.md ...................... guías y contratos (ver «Documentación»)
```

## Requisitos

- Windows 10 u 11.
- [.NET SDK 10](https://dotnet.microsoft.com/download) y [Node.js LTS](https://nodejs.org/) con npm.
- Para la app de estudiante: Unity 6000.6.3f1 con el módulo Android, o la APK ya compilada.
- El portátil y las tablets en la misma red wifi, con el puerto 5080 permitido en el firewall de Windows.

## Ejecución rápida (docente)

1. Clona este repositorio.
2. La primera vez, confía en el certificado HTTPS local:

   ```powershell
   dotnet dev-certs https --trust
   ```

3. Haz doble clic en **`Iniciar Serena.cmd`**. La primera vez instala las dependencias de Node, compila la API, prepara las cuentas de prueba y crea el lanzador. Después abre el navegador en el login.
4. Inicia sesión con una cuenta de prueba (`profesor1@gmail.com` a `profesor10@gmail.com`; la contraseña está en `Serena.Api/seed-demo-teachers.ps1`) o crea la tuya con `.\Serena.Api\create-teacher.ps1`.
5. Elige un capítulo: la sala de espera muestra el código de seis dígitos que los estudiantes escriben en la tablet.

Mantén abierta la ventana de Serena durante la clase; al cerrarla se detienen los servicios. Para comprobar que la API responde, abre `http://localhost:5080/api/health` (debe responder `{"status":"ok"}`).

### Ejecución manual (desarrollo)

Si prefieres ver cada servicio en su propia terminal, desde la raíz del repositorio:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix backend ci
dotnet run --project Serena.Api --launch-profile Serena   # terminal 1
npm.cmd --prefix backend run dev                          # terminal 2
npm.cmd --prefix frontend run dev                         # terminal 3, abre http://localhost:5173
```

La guía detallada, con la solución de problemas, está en [GUIA-USO.md](GUIA-USO.md).

## App de estudiante (tablets)

1. Abre la carpeta `Proy - AppEstudiante` del repositorio [SERENA---AppEstudiante](https://github.com/JCobs23/SERENA---AppEstudiante) con Unity 6000.6.3f1.
2. Escribe la dirección del portátil del docente con el botón **Server** de la pantalla de código, por ejemplo `http://192.168.1.20:5080`. Usa la IPv4 del portátil (`ipconfig`); `localhost` apunta a la propia tablet. La guía de red del aula está en `Proy - AppEstudiante/Documentation/Guia-preparar-aula.md`.
3. Para las tablets, genera la APK con **File → Build Profiles → Android** e instálala.
4. En la tablet: escribe el código de la sala y tu nombre, y pulsa **Ready?** (el botón cambia a **I'm ready**).

## Reporte por correo

El reporte se genera y se descarga sin internet. Para enviarlo por correo hace falta una cuenta de Gmail con contraseña de aplicación:

```powershell
setx SERENA_REPORTS_SMTP_PASSWORD "contraseña-de-aplicación"
```

La cuenta remitente y la lista de destinatarios autorizados se configuran en `Serena.Api/appsettings.json` (`Reports:Smtp` y `Reports:AuthorizedRecipients`). La API rechaza cualquier correo que no esté en la lista. El paso a paso está en [TUTORIAL-REPORTES.md](TUTORIAL-REPORTES.md).

## Seguridad y privacidad

- Login solo por HTTPS; contraseñas guardadas como hash PBKDF2-SHA256 con sal y 600 000 iteraciones.
- Cookie de sesión `HttpOnly`, `Secure` y `SameSite=Strict`, con vencimiento de 8 horas.
- Bloqueo por IP tras 10 intentos de login fallidos, y tras probar 15 códigos de sesión inexistentes distintos.
- Cada docente solo ve y controla sus sesiones y reportes.
- Consultas SQL parametrizadas y escapado de React frente a inyección y XSS.
- Errores con mensajes genéricos, sin trazas internas.
- Reportes sin nombres ni identificadores de estudiantes, enviados solo a destinatarios autorizados.

Limitación conocida: las tablets se comunican por HTTP dentro de la red del aula. Por eso SERENA debe usarse en la red privada del salón y no registra datos personales sensibles. Más detalles en [SECURITY.md](SECURITY.md).

## Pruebas

El documento del proyecto (entregable AV3) registra los casos de prueba:

- **Sistema (SIS-01 a SIS-11):** recorren el flujo de extremo a extremo, desde el login hasta el envío del reporte, e incluyen la reconexión de una tablet y la clase interrumpida, que deja un reporte parcial.
- **Seguridad (SEG-01 a SEG-16):** cookie, fuerza bruta, almacenamiento de contraseñas, aislamiento entre docentes, inyección SQL y XSS, validación de entradas, privacidad y enumeración de códigos.
- **Con usuarios:** dos iteraciones con una docente del colegio.

En la red local, la API respondió entre 2 y 92 ms; el valor más alto corresponde al login, por el cálculo del hash.

## Cómo se hizo

- **Metodología.** Scrum en cuatro sprints de unas dos semanas, de septiembre al 12 de noviembre de 2026. Las historias de usuario salieron de un mapa de 11 épicas, se estimaron con Scrum Poker y se siguieron en Jira (To Do → En Progreso → En Revisión → Hecho).
- **Organización.** Cada integrante trabajó en su propia rama y en un carril de archivos. Los equipos se coordinaron con contratos de interfaz: estado de la sesión, datos del reporte, sonidos y textos. Mientras un endpoint no existía, se trabajó con datos simulados de la misma forma.
- **Integración.** Antes de cada merge se respaldaban los cambios locales, y después se probaba el flujo completo.
- **Arquitectura.** Se diseñó con el modelo C4. En la implementación, SignalR se reemplazó por WebSocket nativo y Entity Framework Core por Microsoft.Data.Sqlite, para reducir dependencias en el portátil del aula.

| Sprint | Fechas | Alcance principal | HU entregadas | Story points |
| --- | --- | --- | --- | --- |
| 1 | hasta el 30 sep | Login, ingreso con código, sala de espera | 9 de 16 | 36 de 60 |
| 2 | 1 – 15 oct | Catálogo, inicio sincronizado, introducción, emoción y decisión | 25 de 29 | 160 de 192 |
| 3 | 15 – 29 oct | Supervisión en vivo, votación, decisión final, SQLite | 45 de 49 | 190 de 214 |
| 4 | 29 oct – 12 nov | Consecuencias, reflexión, progreso, reporte PDF, correo, lanzador | 50 de 50 | 247 de 247 |

Las historias que no se terminaban en un sprint pasaban al siguiente. Al cierre del Sprint 4 se completó todo el backlog: 633 story points.

## Documentación

| Archivo | Contenido |
| --- | --- |
| [GUIA-USO.md](GUIA-USO.md) | Instalación, ejecución y flujo completo de una clase |
| [TUTORIAL-REPORTES.md](TUTORIAL-REPORTES.md) | Reportes, historial, PDF y envío por correo |
| [CONTRATO-ESTADO-SESION.md](CONTRATO-ESTADO-SESION.md) | Estado compartido entre API, web, proyección y tablets |
| [CONTRATO-SONIDOS.md](CONTRATO-SONIDOS.md) | Sonidos del panel y del resumen, y sus niveles |
| [GUIA-LENGUAJE-RESULTADOS.md](GUIA-LENGUAJE-RESULTADOS.md) | Lenguaje neutral de los resultados |
| [INTEGRACION-UNITY.md](INTEGRACION-UNITY.md) | Endpoints que usa la app de estudiante |
| [SECURITY.md](SECURITY.md) | Flujo de seguridad del inicio de sesión |

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| La tablet no encuentra la sesión | Verifica que la tablet y el portátil estén en la misma red, que la dirección del botón **Server** sea la IPv4 del portátil y que el firewall permita el puerto 5080. |
| El login dice que se requiere HTTPS | Ejecuta `dotnet dev-certs https --trust` y vuelve a abrir Serena. |
| «Too many attempts» al ingresar el código | La tablet probó muchos códigos inexistentes; espera 10 minutos o usa el código correcto de la sala. |
| No se puede enviar el reporte | Falta la variable `SERENA_REPORTS_SMTP_PASSWORD` o el correo no está en la lista autorizada. El PDF se puede descargar igualmente. |
| El puerto 5080 está ocupado | Ya hay una copia de Serena abierta; ciérrala antes de iniciar otra. |
