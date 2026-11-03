# Flujo de seguridad del inicio de sesión

## Flujo implementado

1. El docente usa el formulario React/Vite; la contraseña se oculta con `type="password"` y el navegador valida los campos obligatorios.
2. `LoginScreen` envía un `POST` JSON a `/api/auth/login`. Las credenciales no se incluyen en la URL, no se registran en consola y no se guardan en `localStorage`.
3. ASP.NET Core verifica la contraseña contra `Serena.Api/Data/teachers.json` mediante PBKDF2-HMAC-SHA256, con sal aleatoria, 600.000 iteraciones y comparación en tiempo constante. El JSON no guarda contraseñas en texto plano y está excluido de Git.
4. Con credenciales válidas, el servidor crea una cookie de sesión aleatoria con `HttpOnly`, `Secure`, `SameSite=Strict` y vencimiento de ocho horas. El token no se expone a JavaScript y se invalida al cerrar sesión.
5. Los endpoints docentes requieren HTTPS y una cookie válida. Los errores no distinguen entre un correo inexistente y una contraseña errónea; el servidor limita los intentos por IP.

## Desarrollo y despliegue

Prepara el certificado local con `dotnet dev-certs https --trust`. El proxy Vite de desarrollo usa el certificado autofirmado de `https://localhost:5081`; esa configuración solo es apropiada para localhost. En producción se requiere HTTPS de extremo a extremo, con un certificado válido y un proxy que lo verifique.

La API de Unity continúa usando HTTP en el puerto 5080 y las sesiones están en memoria. No usar el sistema con información real del aula hasta migrar ese tramo a HTTPS y persistencia protegida.

## Verificación de registros

No se deben registrar cuerpos de solicitudes, contraseñas, cookies ni tokens. Para comprobarlo, usa una cuenta ficticia e inspecciona los registros del navegador, ASP.NET Core y Node; la contraseña de prueba no debe aparecer. No compartas archivos HAR que contengan credenciales.
