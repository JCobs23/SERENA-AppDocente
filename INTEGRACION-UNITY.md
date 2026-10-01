# Integración del flujo docente con Unity

La app web conserva la estructura React/Vite del trabajo del equipo. El flujo es login → bienvenida → catálogo → sala de espera con código.

- React implementa el login en `frontend/src/components/LoginScreen.tsx`; `App.tsx` mantiene la navegación existente.
- Al elegir la narrativa se crea un código en ASP.NET Core (`POST /api/sessions`). La sala lo presenta y actualiza la lista de estudiantes consultando `GET /api/sessions/{code}/students`.
- Unity valida el código con `GET /api/sessions/{code}` y registra el nombre con `POST /api/sessions/{code}/students`.
- El backend Node/Socket.IO se conserva para los eventos existentes del compañero.

Para instrucciones de instalación y ejecución, consulta `GUIA-USO.md`. El login requiere HTTPS y el registro de estudiantes por Unity aún usa HTTP para la demostración local; no usar con datos reales hasta asegurar esa comunicación.
