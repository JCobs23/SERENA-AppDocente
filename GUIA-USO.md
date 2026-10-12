# Serena: guía de uso e integración

Esta guía cubre el inicio de sesión docente, las pantallas React del equipo y la creación de un código que Unity puede validar.

## Requisitos

- Windows, PowerShell y .NET SDK 10.
- Node.js compatible con el proyecto y npm.
- Unity 6 para probar la app de estudiante en el Editor.

## 1. Preparar el certificado local

Una sola vez, desde PowerShell:

```powershell
dotnet dev-certs https --trust
```

Acepta la solicitud de confianza de Windows. La API usa HTTPS en `https://localhost:5081` para inicio de sesión y operaciones docentes.

## 2. Registrar la cuenta docente

Desde la raíz del repositorio ejecuta:

```powershell
.\Serena.Api\create-teacher.ps1
```

Ingresa un correo `@gmail.com` y una contraseña de al menos 12 caracteres. PowerShell oculta la contraseña mientras escribes. El asistente crea `Serena.Api/Data/teachers.json` con el correo, una sal aleatoria y el hash PBKDF2; no guarda la contraseña en texto plano. No hay cuentas precargadas. Para cambiar una contraseña, ejecuta el asistente otra vez con el mismo correo.

## 3. Instalar dependencias

Abre tres terminales en VS Code, todas desde la raíz del repositorio. En cada una instala una vez las dependencias:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix backend ci
```

## 4. Iniciar los tres servicios

Deja cada proceso ejecutándose en su propia terminal:

**Terminal 1 — API REST ASP.NET Core:**

```powershell
dotnet run --project Serena.Api --launch-profile Serena
```

**Terminal 2 — backend Socket.IO del compañero:**

```powershell
npm.cmd --prefix backend run dev
```

**Terminal 3 — app React/Vite:**

```powershell
npm.cmd --prefix frontend run dev
```

Abre la dirección que Vite muestra, normalmente `http://localhost:5173`. La configuración Vite reenvía `/api` a la API HTTPS local. Ese proxy es solo para desarrollo en el mismo computador; la API recibe las credenciales cifradas por TLS. No expongas el servidor Vite en la red del aula.

Si algún puerto aparece ocupado, detén la instancia vieja con `Ctrl+C` en su terminal antes de volver a iniciar.

## 5. Seguir el flujo docente

1. El login es la primera pantalla. Escribe el correo y la contraseña que registraste. El campo de contraseña está enmascarado; el botón del ojo permite mostrarla.
2. Al autenticar, aparece **Bienvenido a Serena**, la pantalla del compañero.
3. Pulsa **Continuar** para abrir el catálogo de narrativas.
4. Selecciona la primera narrativa habilitada. La API crea un código aleatorio de seis dígitos y abre la sala de espera.
5. El codigo se muestra en grupos de tres cifras. La sala recibe por WebSocket las conexiones y abandonos; si se corta, se reconecta y obtiene una instantanea actualizada. Cerrar sesion invalida la cookie docente.

El login, la bienvenida y el catalogo siguen dentro de frontend/src. Socket.IO conserva los eventos del equipo. La presencia usa un WebSocket autenticado con Serena.Api. Unity envia latidos cada 5 segundos; tras 15 segundos sin respuesta, la sala marca al estudiante desconectado. Al recuperar la red, el mismo identificador lo marca reconectado.

## 6. Probar Unity desde el Editor

1. Abre el proyecto `D:\Chavi\UAO\SEMESTRE_8\Diseño2\SERENA---AppEstudiante\Proy - AppEstudiante`.
2. En `SessionCodeEntryController` y `StudentNameController`, establece **Server Base Url** en `http://127.0.0.1:5080` para probar en el mismo computador.
3. Abre la escena `IngresoCodigo`, pulsa **Play** e ingresa el código de la sala.
4. Escribe un nombre para registrarte. Regresa a la sala docente; el estudiante aparece al instante como conectado.
5. Para simular una salida, pausa Unity o desconecta temporalmente su red. Despues de 15 segundos sin latidos, la sala lo marca como desconectado. Al reanudar, el mismo ID lo muestra reconectado. Repite con varios dispositivos para observar cambios simultaneos. Varias ventanas del Editor en el mismo equipo pueden compartir PlayerPrefs y reutilizar el mismo ID.

Reiniciar la API borra sesiones y códigos porque todavía se guardan en memoria. Unity Editor y API deben ejecutarse en el mismo equipo durante esta prueba. En una tablet hace falta usar la IP LAN del PC y habilitar el puerto 5080 en el firewall.

## Qué se conecta con cada servicio

- `Serena.Api`: login, cookie docente, códigos de sesión y lista REST de estudiantes.
- `backend` (Node/Socket.IO): eventos existentes del flujo del compañero.
- `frontend` (React/Vite): navegación login → bienvenida → catálogo → sala con código.
- Unity: valida el código y registra el nombre mediante REST.

El código de cuenta queda local en `Serena.Api/Data/teachers.json`, excluido de Git. La lista de estudiantes vive en memoria. Los errores de login son genéricos y el código de autenticación no imprime contraseñas en consola.

## Límites antes de usar datos reales

El login se envía desde Vite local a la API por TLS, pero el proxy de desarrollo desactiva la validación del certificado local. En un despliegue se debe servir el frontend y la API en HTTPS con certificados válidos, no usar el servidor de desarrollo Vite y retirar esa excepción del proxy. La comunicación de Unity con la API en el puerto 5080 todavía usa HTTP y transmite el nombre sin cifrar. No usar con datos reales hasta proteger también ese tramo. Para el despliegue se debe migrar el JSON local a una base de datos con permisos y copias protegidas.

## 7. Iniciar y sincronizar la experiencia

1. En la sala docente, mantén Unity en Play y conecta al menos un estudiante con el código mostrado.
2. En Unity, cada estudiante pulsa **¿Ready?**. Deben estar listos todos los estudiantes conectados antes de que el docente pueda iniciar.
3. Pulsa **Iniciar experiencia y abrir proyección**. El servidor no permite iniciar si no hay estudiantes conectados.
4. La proyección abre en otra pestaña. Al recibir el inicio, cada tablet carga la escena 3_Narrativa y reproduce el video introductorio desde StreamingAssets.
5. Cuando todas las tablets terminen la introducción, usa **Etapa anterior** y **Avanzar etapa** en la pantalla de proyección. La proyección y las tablets consultan el mismo estado de sesión; la etapa va desde la narrativa inicial hasta la reflexión.
