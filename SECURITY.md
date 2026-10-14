# Flujo de seguridad del inicio de sesión

## Flujo implementado

1. El docente abre Serena desde el frontend React/Vite. El campo de contraseña usa `type="password"` y el navegador valida correo, dominio `@gmail.com` y campos obligatorios.
2. `LoginScreen` envía un `POST` JSON a `/api/auth/login`; en desarrollo Vite lo reenvía a `https://localhost:5081`. Las credenciales no se incluyen en la URL, no se imprimen en consola y no se guardan en `localStorage`.
3. ASP.NET Core busca el correo en `Serena.Api/Data/teachers.json`. Verifica la contraseña con PBKDF2-HMAC-SHA256, sal aleatoria de 16 bytes, 600.000 iteraciones y comparación en tiempo constante. El JSON nunca contiene contraseñas en texto plano.
4. Con credenciales válidas, el servidor crea una cookie de sesión aleatoria con `HttpOnly`, `Secure`, `SameSite=Strict` y vencimiento de ocho horas. El token no se entrega a JavaScript. La API invalida la cookie al cerrar sesión.
5. Los endpoints que crean sesión docente o consultan su lista de estudiantes requieren HTTPS y una cookie válida. Unity solo necesita el código temporal para unirse.
6. Los errores no distinguen si falló el correo o la contraseña. El servidor limita intentos por IP y no registra cuerpos de solicitudes ni valores de credenciales.

## Registrar cuentas

`Serena.Api/create-teacher.ps1` solicita la contraseña como `SecureString` y guarda en `Serena.Api/Data/teachers.json` el correo, sal, hash PBKDF2 e iteraciones. Ese archivo se excluye de Git. La validación actual permite `@gmail.com`; si el colegio utiliza otro dominio, debe acordarse y ajustarse tanto en `LoginScreen.tsx` como en el script de registro.

## Desarrollo y despliegue

El certificado de desarrollo se prepara con `dotnet dev-certs https --trust`. El proxy Vite local reenvía `/api` a HTTPS con `secure: false` para aceptar el certificado local autofirmado. Solo debe usarse en localhost. En producción se necesita HTTPS de extremo a extremo con certificado válido y proxy configurado para verificarlo.

La API de Unity aún usa HTTP en el puerto 5080. Los nombres de estudiantes no están cifrados en ese tramo y las sesiones siguen en memoria. No es adecuado para información real del aula hasta migrarlo a HTTPS y persistencia protegida.

## Verificación de logs

La interfaz no llama a `console` con credenciales. ASP.NET Core no tiene logging de cuerpos HTTP configurado; no añadir registros de `LoginRequest`, contraseñas, cookies ni tokens. La consola de Node registra conexiones Socket.IO, nunca credenciales. Para comprobarlo, usa una cuenta ficticia, inspecciona logs y consola, e intenta buscar una contraseña de prueba: no debe aparecer. No compartas capturas HAR con credenciales.
