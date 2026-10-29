# Persistencia SQLite de Serena.Api

La API crea `Data/serena.db` al iniciar. La ruta se puede cambiar con `Database:Path` en `appsettings.json` o con configuración de entorno `Database__Path`.

El esquema relacional contiene:

- `Teachers`: correo y credenciales derivadas con PBKDF2.
- `ClassroomSessions`: estado y configuración de cada sesión narrativa.
- `Students`: participantes de cada sesión.
- `StudentInteractions`: emoción, decisión y respuestas de reflexión.
- `Votes`: voto final por participante y sesión.

El archivo `Data/teachers.json` se importa/actualiza en SQLite al iniciar como mecanismo de compatibilidad con el aprovisionamiento actual de cuentas. La API usa SQLite para consultar credenciales durante el login. El archivo `.db` no se versiona; conserva los datos en la máquina o servidor donde corre la API.

Al reiniciar la API, las sesiones no vencidas se restauran. Sus participantes quedan desconectados hasta que reconecten y la reproducción multimedia queda pausada.
