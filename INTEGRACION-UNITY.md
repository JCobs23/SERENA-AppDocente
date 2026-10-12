# Integración del flujo docente con Unity

La app web conserva la estructura React/Vite del trabajo del equipo. El flujo es login → bienvenida → catálogo → sala de espera con código.

- React implementa el login en `frontend/src/components/LoginScreen.tsx`; `App.tsx` mantiene la navegación existente.
- Al elegir la narrativa se crea un codigo en ASP.NET Core (POST /api/sessions). La sala docente abre un WebSocket autenticado en /api/sessions/{code}/stream, recibe una instantanea inicial y los cambios en vivo; GET /api/sessions/{code}/students queda como consulta de respaldo.
- Unity valida el codigo con GET /api/sessions/{code} y registra nombre e identificador persistente con POST /api/sessions/{code}/students. Envia un latido cada 5 segundos a POST /api/sessions/{code}/students/{studentId}/heartbeat. Si pasan 15 segundos sin latidos, la API marca al estudiante desconectado; al volver con el mismo ID, lo marca reconectado. POST /api/sessions/{code}/students/{studentId}/leave registra una salida explicita.
- El backend Node/Socket.IO se conserva para los eventos existentes del equipo. La presencia usa WebSocket directo con Serena.Api.

Para instrucciones de instalación y ejecución, consulta `GUIA-USO.md`. El login requiere HTTPS y el registro de estudiantes por Unity aún usa HTTP para la demostración local; no usar con datos reales hasta asegurar esa comunicación.
