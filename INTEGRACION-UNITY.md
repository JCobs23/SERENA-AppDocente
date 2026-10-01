# Integración local con la app Unity

La API ASP.NET expone el flujo de sesión para que el docente cree un código y los estudiantes se unan desde Unity.

## Ejecutar en el computador del docente

1. Desde la raíz del repositorio, inicia la API:

   ```powershell
   dotnet run --project Serena.Api
   ```

   La API escucha en el puerto `5080`. Confirma que responde en `http://localhost:5080/api/health`.

2. Abre `sessions.html` con Live Server. Deja `http://localhost:5080` como dirección del servidor y pulsa **Crear sesión**. Comparte el código de seis dígitos.

3. En Unity abre `Proy - AppEstudiante`. En `SessionCodeEntryController` y `StudentNameController`, configura `Server Base Url` con la dirección LAN del computador docente, por ejemplo `http://192.168.1.20:5080`. Ambos dispositivos deben estar en la misma red. Permite el puerto 5080 en el firewall del computador.

4. Ejecuta la app: ingresa el código, escribe el nombre y continúa. La pantalla docente **Actualizar estudiantes** consulta la lista del grupo.

En Unity Editor, `http://127.0.0.1:5080` sirve cuando la API se ejecuta en el mismo equipo. En una tablet Android, `127.0.0.1` se refiere a la propia tablet: usa la IP LAN del computador docente. Se puede sobrescribir la dirección sin recompilar con `PlayerPrefs.SetString("SerenaServerUrl", "http://192.168.1.20:5080")`.

## Endpoints

- `POST /api/sessions`: crea una sesión y devuelve su código.
- `GET /api/sessions/{code}`: valida que el código esté activo.
- `POST /api/sessions/{code}/students` con `{"name":"Nombre Apellido"}`: registra al estudiante.
- `GET /api/sessions/{code}/students`: devuelve el grupo conectado.

Las sesiones viven en memoria y expiran después de cuatro horas; reiniciar la API las borra.

## Alcance de seguridad

Esta conexión es un prototipo de red local. Los endpoints todavía no exigen autenticación y el transporte HTTP no cifra los datos. No la expongas fuera de una red de pruebas ni la uses con datos reales. Para producción hacen falta HTTPS, autenticación/autorización docente, control de origen adecuado, límites de solicitudes y persistencia segura. El inicio de sesión web existente sigue pendiente de conectar a un servicio real de autenticación.
