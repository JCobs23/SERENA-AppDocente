# Serena: guía de uso e integración

Esta guía cubre el inicio de sesión docente, las pantallas React del equipo y la creación de un código que Unity puede validar.

## Requisitos

- Windows, PowerShell y .NET SDK 10.
- Node.js compatible con el proyecto y npm.
- Unity 6 para probar la app de estudiante en el Editor.

## 1. Preparar el certificado local

Haz este paso una sola vez. Abre PowerShell en la carpeta del repositorio y ejecuta:

```powershell
dotnet dev-certs https --trust
```

Acepta la solicitud de confianza de Windows. Serena.Api usa HTTPS en `https://localhost:5081` para el inicio de sesión y las operaciones docentes.

## 2. Registrar la cuenta docente

Hazlo una sola vez o cuando quieras cambiar la contraseña. Desde la raíz del repositorio ejecuta:

```powershell
.\Serena.Api\create-teacher.ps1
```

Ingresa un correo `@gmail.com` y una contraseña de al menos 12 caracteres. PowerShell oculta la contraseña mientras escribes. El asistente genera `Serena.Api/Data/teachers.json` con una sal aleatoria y el hash PBKDF2; al iniciar, la API importa esas credenciales a SQLite (`Serena.Api/Data/serena.db`). La contraseña no se guarda en texto plano. No hay cuentas precargadas.

## 3. Instalar dependencias

Hazlo la primera vez o después de cambiar las dependencias. Abre una terminal PowerShell de VS Code en la raíz del repositorio y ejecuta ambos comandos:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix backend ci
```

Si la terminal no está en la raíz del repositorio, primero ejecuta:

```powershell
cd "D:\Usefull\Documentos\GitHub\SERENA-AppDocente"
```

## 4. Iniciar los servicios, desde cero

Necesitas **tres terminales PowerShell separadas** en VS Code. En cada una, confirma que la carpeta actual sea `D:\Usefull\Documentos\GitHub\SERENA-AppDocente`. No cierres estas terminales durante la prueba.

**Terminal 1 — Serena.Api:** ejecuta:

```powershell
dotnet run --project Serena.Api --launch-profile Serena
```

Déjala abierta. Comprueba que la API responde abriendo `http://localhost:5080/api/health` en el navegador del computador. Debe aparecer `{"status":"ok"}`. Si la página no responde, la API no está iniciada; revisa los mensajes de esta terminal. No intentes iniciar otra copia si el puerto ya está ocupado: detén la instancia anterior con `Ctrl+C` en su terminal y vuelve a ejecutar el comando.

**Terminal 2 — backend Socket.IO:** ejecuta:

```powershell
npm.cmd --prefix backend run dev
```

Déjala abierta mientras uses las funciones del compañero.

**Terminal 3 — app React/Vite:** ejecuta:

```powershell
npm.cmd --prefix frontend run dev
```

Abre la dirección que muestra Vite, normalmente `http://localhost:5173`. Mantén abiertas las tres terminales: Serena.Api, backend y Vite. No ejecutes el comando de Serena.Api en la terminal de Vite.

Vite reenvía las solicitudes `/api` a Serena.Api por HTTPS local. Esta configuración es para desarrollo en el mismo computador; no expongas Vite en la red del aula. Para conectar tablets, configura en Unity la IP LAN del computador en `Server Base Url` y deja Serena.Api ejecutándose en el puerto 5080.

**Actualizaciones de código (solo antes de iniciar una sesión nueva):** si modificaste Serena.Api, detén el proceso con `Ctrl+C` en la Terminal 1 y vuelve a ejecutar el comando de inicio. Al reiniciar se borran las sesiones y los códigos, por eso hazlo antes de crear la sesión y conectar las tablets, nunca durante una experiencia. Si modificaste scripts de Unity, además genera e instala un build Android nuevo antes de la siguiente sesión. Para el uso normal no reinicies los servicios.
## 5. Seguir el flujo docente

1. El login es la primera pantalla. Escribe el correo y la contraseña que registraste. El campo de contraseña está enmascarado; el botón del ojo permite mostrarla.
2. Al autenticar, aparece **Bienvenido a Serena**, la pantalla del compañero.
3. Pulsa **Continuar** para abrir el catálogo de narrativas.
4. Selecciona la primera narrativa habilitada. La API crea un código aleatorio de seis dígitos y abre la sala de espera.
5. El codigo se muestra en grupos de tres cifras. La sala recibe por WebSocket las conexiones y abandonos; si se corta, se reconecta y obtiene una instantanea actualizada. Cerrar sesion invalida la cookie docente.

El login, la bienvenida y el catalogo siguen dentro de frontend/src. Socket.IO conserva los eventos del equipo. La presencia usa un WebSocket autenticado con Serena.Api. Unity envia latidos cada 5 segundos; tras 15 segundos sin respuesta, la sala marca al estudiante desconectado. Al recuperar la red, el mismo identificador lo marca reconectado.

## 6. Probar Unity desde el Editor

1. Abre el proyecto `D:\Materias\2026-02\DM2\Proyecto\SERENA---AppEstudiante\Proy - AppEstudiante`.
2. Para probar en el Editor del mismo computador, establece **Server Base Url** en `http://127.0.0.1:5080` en los controladores de Unity.
3. Para probar en una tablet, reemplaza `127.0.0.1` por la IP LAN del computador que ejecuta la API, por ejemplo `http://192.168.1.20:5080`. Usa esa URL en `SessionCodeEntryController`, `StudentNameController`, `StudentReadyButtonController`, `StudentRosterController` y `NarrativeStartListener` antes de generar el build. La tablet y el computador deben estar en la misma red y el firewall debe permitir el puerto 5080.
4. Abre la escena `1_IngresoCodigo`, pulsa **Play** e ingresa el código de la sala.
5. Escribe un nombre para registrarte. Regresa a la sala docente; el estudiante aparece al instante como conectado.
6. Para simular una salida, pausa Unity o desconecta temporalmente su red. Después de 15 segundos sin latidos, la sala lo marca como desconectado. Al reanudar, el mismo ID lo muestra reconectado. Repite con varios dispositivos para observar cambios simultáneos. Varias ventanas del Editor en el mismo equipo pueden compartir PlayerPrefs y reutilizar el mismo ID.

La API guarda las sesiones, participantes, respuestas, reflexiones y votos en `Serena.Api/Data/serena.db`. Las sesiones no vencidas se restauran al reiniciar durante su ventana de 4 horas; el docente tendrá que iniciar sesión otra vez, los participantes reconectarse y la reproducción se reanuda pausada. La base se crea automáticamente y se excluye de Git. Para probar en una tablet, permite que esta acceda a la IP LAN del computador por el puerto 5080. Los cambios de scripts no se aplican a la app ya instalada: después de actualizar Unity, genera e instala un build Android nuevo.

## Qué se conecta con cada servicio

- `Serena.Api`: login, cookie docente, códigos de sesión y lista REST de estudiantes.
- `backend` (Node/Socket.IO): eventos existentes del flujo del compañero.
- `frontend` (React/Vite): navegación login → bienvenida → catálogo → sala con código.
- Unity: valida el código y registra el nombre mediante REST.

Las credenciales se consultan desde SQLite; `teachers.json` se conserva como archivo de aprovisionamiento y se importa al arrancar. La lista de participantes y las interacciones quedan en SQLite. El archivo `serena.db` es local al servidor y está excluido de Git.

## Límites antes de usar datos reales

El login se envía desde Vite local a la API por TLS, pero el proxy de desarrollo desactiva la validación del certificado local. En un despliegue se debe servir el frontend y la API en HTTPS con certificados válidos, no usar el servidor de desarrollo Vite y retirar esa excepción del proxy. La comunicación de Unity con la API en el puerto 5080 todavía usa HTTP y transmite el nombre sin cifrar. No usar con datos reales hasta proteger también ese tramo. En el despliegue, limita permisos del archivo SQLite y configura copias de seguridad protegidas.

## 7. Iniciar y sincronizar la experiencia

1. En la sala docente, mantén Unity en Play y conecta al menos un estudiante con el código mostrado.
2. En Unity, cada estudiante pulsa **¿Ready?**. Deben estar listos todos los estudiantes conectados antes de que el docente pueda iniciar.
3. Pulsa **Iniciar experiencia y abrir proyección**. El servidor no permite iniciar si no hay estudiantes conectados.
4. La proyección abre en otra pestaña. Al recibir el inicio, cada tablet carga la escena 3_Narrativa y reproduce el video introductorio desde StreamingAssets.
5. Si hace falta avanzar antes de que termine el video, pulsa **Omitir introducción** en la proyección o en la sala docente. La API marca la introducción como terminada para los estudiantes conectados y avanza a la Etapa 1. Unity detiene el video introductorio al recibir la orden; el estudiante no tiene un control para omitirlo. Durante la experiencia no reinicies Serena.Api ni Unity.
6. Cuando todas las tablets terminen la introducción, la API avanza a la Etapa 1 y cada tablet reproduce `SerenaNarrativa.mp4` desde `3_Narrativa`. Durante la experiencia, controla el video desde la proyección con **Pausar**, **Reanudar**, **atrasar 5 s** y **adelantar 5 s**. Ambas pantallas muestran una barra de progreso y el tiempo actual/duración: en la proyección debajo de los controles y en la tablet al pie de la pantalla. Al pausar, la tablet conserva el fotograma actual desenfocado mientras espera; al terminar el video, conserva el último fotograma borroso hasta que el docente avance. En la Etapa 2, la tablet mantiene ese fondo borroso y presenta cinco tarjetas para que cada estudiante toque la emoción que siente; la tarjeta elegida queda marcada y se puede cambiar mientras siga en esa etapa. Para usar las ilustraciones adjuntas, crea `Assets/Resources/Emociones/` en el proyecto Unity y copia ahí los cinco PNG con estos nombres: `curiosidad.png`, `fuera.png`, `neutro.png`, `confundido.png` e `incomodo.png`. El script los carga automáticamente; no los arrastres a la escena ni configures objetos en el Inspector. Si falta un archivo, esa tarjeta usa el emoji de respaldo. Para agregar o reemplazar el video, copia `frontend/public/videos/narrativa-inicial.mp4` como `Assets/StreamingAssets/SerenaNarrativa.mp4` (MP4/H.264 recomendado). Los cambios visuales en Unity requieren generar e instalar un build Android actualizado antes de la siguiente prueba; estos cambios no requieren reiniciar Serena.Api.
7. Para interrumpir la introducción o una etapa y volver al catálogo, pulsa **Volver a escoger capítulos** en la proyección o **Volver a capítulos** en la sala docente. La web envía `POST /api/sessions/{code}/reset`; la API termina la experiencia de esa sesión.
8. Al volver el docente al catálogo, Unity detecta el reinicio, detiene el video o la etapa, limpia el código y carga `1_IngresoCodigo`. No hacen falta comandos ni reinicios durante este flujo normal. Solo instala otro build Android si actualizaste los scripts de Unity; consulta la sección 4.
