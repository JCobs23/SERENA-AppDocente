# Tutorial: reportes de sesión en Serena

Esta guía explica cómo generar, consultar, descargar y enviar por correo el **reporte grupal** que Serena crea al terminar una sesión.

> El reporte es **anónimo**: solo contiene totales del grupo (emociones, decisiones, votos y reflexión). No guarda nombres ni identificadores de estudiantes.

---

## 1. Qué hace y dónde se guarda

| Acción | Dónde ocurre |
|---|---|
| Generar el reporte | La API (`Serena.Api/SessionReports.cs`) toma los datos de la sesión y crea un resumen y un PDF |
| Guardarlo | Base de datos SQLite local: `Serena.Api/Data/serena.db`, tabla `SessionReports` |
| Verlo | Pantalla **Reporte grupal** de la app docente |
| Consultar los anteriores | Botón **Reportes anteriores** en el catálogo |
| Enviarlo por correo | Gmail por SMTP, con el PDF adjunto y el asunto **«Informe estudiantes»** |

Cosas importantes:

- **Un reporte por sesión.** Si se pide dos veces el reporte de la misma sesión, se devuelve el mismo; no se duplica.
- **Cada docente ve solo sus reportes.** Si entras con otra cuenta, no verás los reportes de las demás.
- **La base de datos es local.** `serena.db` no se sube a Git (está en `.gitignore`). Los reportes quedan en el computador donde corre la API.

---

## 2. Requisitos

1. Serena funcionando con **`Iniciar Serena.cmd`** (consulta `GUIA-USO.md`).
2. Una cuenta docente. Las cuentas de prueba son `profesor1@gmail.com` a `profesor10@gmail.com`, con la contraseña `123456789abc`.
3. Al menos un estudiante conectado desde la app de Unity. Sin una narrativa iniciada no se genera reporte.

Para **ver y descargar** reportes no hace falta configurar nada más. El correo (sección 4) es opcional.

---

## 3. Generar y consultar un reporte

### 3.1 Al terminar la experiencia

1. Inicia una sesión desde el catálogo y conecta a los estudiantes.
2. Recorre las etapas hasta la **Etapa 5 (cierre)**.
3. En el panel de decisión final pulsa uno de estos botones:
   - **Ver reporte grupal** si elegiste avance automático, o
   - **Cerrar sesión y ver reporte** si elegiste votación.
4. Se abre la pantalla **Reporte grupal**, con:
   - participantes y conectados al cierre,
   - estado: *Completada* o *Parcial*,
   - distribución de emociones, decisiones y votos,
   - resultados de la reflexión (sí / no / sin respuesta por pregunta).

### 3.2 Si la sesión se interrumpe

Si pulsas **Volver a escoger capítulos** cuando la narrativa ya había empezado, la API **guarda igualmente un reporte** con estado **Parcial**. Así no se pierden los datos de una clase que se cortó a mitad.

### 3.3 Ver reportes anteriores

1. En el catálogo pulsa **Reportes anteriores** (arriba a la derecha).
2. Verás la lista de sesiones con fecha, número de participantes y estado.
3. Pulsa **Abrir reporte** para verlo de nuevo.

### 3.4 Descargar el PDF

En la pantalla del reporte pulsa **Descargar PDF**. El archivo se llama `SERENA-<código de sesión>.pdf`.

---

## 4. Configurar el envío por correo (Gmail)

El botón **Enviar informe** manda el PDF a un correo de una **lista autorizada**. Para que funcione hay que configurar tres cosas: la cuenta que envía, la contraseña de aplicación y los destinatarios.

### 4.1 Crear una contraseña de aplicación en Google

Gmail no permite usar tu contraseña normal para SMTP. Hace falta una **contraseña de aplicación**:

1. Entra a tu cuenta de Google en <https://myaccount.google.com/security>.
2. Activa la **verificación en dos pasos** si aún no la tienes. Es obligatoria.
3. Abre <https://myaccount.google.com/apppasswords>.
4. Escribe un nombre, por ejemplo `Serena`, y pulsa **Crear**.
5. Copia la clave de 16 letras que aparece. Google no vuelve a mostrarla.

### 4.2 Guardar la contraseña en Windows (no en el repositorio)

La contraseña **nunca** va en `appsettings.json` ni en Git. Se guarda como variable de entorno.

Abre **PowerShell** o **CMD** y ejecuta, cambiando el texto por tu clave:

```powershell
setx SERENA_REPORTS_SMTP_PASSWORD "abcd efgh ijkl mnop"
```

- Los espacios dan igual; la API los quita.
- `setx` solo afecta a los programas que se abran **después**. Cierra la consola y **cierra también VS Code** si Serena se inicia desde su terminal.

### 4.3 Configurar la cuenta que envía y los destinatarios

Edita `Serena.Api/appsettings.json`, sección `Reports`:

```json
"Reports": {
  "AuthorizedRecipients": [
    "coordinacion@ejemplo.com",
    "docente@ejemplo.com"
  ],
  "Smtp": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "EnableSsl": true,
    "Username": "tu-cuenta@gmail.com",
    "From": "tu-cuenta@gmail.com"
  }
}
```

| Campo | Qué poner |
|---|---|
| `AuthorizedRecipients` | Correos a los que se **permite** enviar el informe. Solo esos aparecen en la lista desplegable; la API rechaza cualquier otro. |
| `Username` | La cuenta de Gmail **de la que creaste** la contraseña de aplicación. |
| `From` | Normalmente el mismo correo que `Username`. |
| `Host`, `Port`, `EnableSsl` | Déjalos como están para Gmail. |

> ⚠️ `appsettings.json` sí está en Git. Si cambias la cuenta o los destinatarios para probar en tu computador, avisa al equipo antes de hacer commit de ese cambio.

### 4.4 Reiniciar Serena

1. Cierra la ventana de **Serena-Docente** y la consola de *Iniciar Serena*.
2. Vuelve a abrir **`Iniciar Serena.cmd`**.

> Al reiniciar la API se pierden las sesiones de clase activas, pero **no** los reportes: esos están guardados en `serena.db`.

### 4.5 Enviar

1. Abre un reporte (al terminar una sesión o desde **Reportes anteriores**).
2. En **Destinatario autorizado** elige el correo.
3. Pulsa **Enviar informe**.
4. Si sale bien verás: *«Informe enviado a … con el asunto «Informe estudiantes»»*. El correo llega con el PDF `Informe-estudiantes-<código>.pdf` adjunto.

---

## 5. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| *«No se pudo guardar el reporte grupal…»* al terminar | La API se reinició o la sesión expiró | Revisa que Serena siga abierta. Si se reinició, la sesión de clase ya no existe: inicia una nueva. |
| La lista **Destinatario autorizado** está vacía | `AuthorizedRecipients` vacío o con correos mal escritos | Corrige `appsettings.json` y reinicia Serena. |
| *«No se pudo enviar. Revisa la configuración SMTP…»* | Falta la variable `SERENA_REPORTS_SMTP_PASSWORD`, o Serena se abrió antes de crearla | Repite 4.2 y cierra y vuelve a abrir VS Code y Serena. |
| Igual, aunque la variable existe | La contraseña de aplicación no corresponde a la cuenta de `Username`, o fue revocada | Crea otra contraseña de aplicación para **esa** cuenta (4.1). |
| **Reportes anteriores** sale vacío | Entraste con otra cuenta docente, o es otro computador | Entra con la cuenta que dirigió la sesión, en el computador donde corre la API. |
| El reporte sale como **Parcial** | La sesión no llegó a la Etapa 5 con decisión final | Es lo esperado si la clase se interrumpió. |

Para comprobar si la variable de entorno quedó guardada, abre una consola **nueva** y ejecuta:

```powershell
[Environment]::GetEnvironmentVariable("SERENA_REPORTS_SMTP_PASSWORD", "User") -ne $null
```

Debe responder `True`.

---

## 6. Referencia técnica (API)

Todas las rutas requieren HTTPS y la sesión docente iniciada (cookie).

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/sessions/{code}/report` | Crea el reporte de la sesión, o devuelve el existente |
| `GET` | `/api/reports` | Lista los reportes del docente |
| `GET` | `/api/reports/{reportId}` | Resumen de un reporte |
| `GET` | `/api/reports/{reportId}/pdf` | Descarga el PDF |
| `GET` | `/api/reports/recipients` | Destinatarios autorizados |
| `POST` | `/api/reports/{reportId}/send` | Envía el PDF por correo. Cuerpo: `{ "recipient": "correo@ejemplo.com" }` |

Archivos relevantes:

- `Serena.Api/SessionReports.cs`: cálculo del resumen, generación del PDF y envío SMTP.
- `Serena.Api/Data/SerenaDatabase.cs`: tabla `SessionReports`.
- `frontend/src/components/SessionSummary.tsx`: pantalla del reporte, envío y descarga.
- `frontend/src/components/ReportHistory.tsx`: pantalla de reportes anteriores.
