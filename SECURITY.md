# Flujo de seguridad del inicio de sesión

## Flujo previsto

1. El docente ingresa su correo institucional y contraseña en el formulario. El campo de contraseña usa `type="password"`, por lo que el navegador muestra puntos o asteriscos según el sistema. El botón de ojo permite revelar u ocultar el valor de forma voluntaria.
2. El navegador valida que el correo tenga un formato válido y que la contraseña no esté vacía.
3. El formulario envía un `POST` JSON a `/api/auth/login`. En despliegue, esta ruta debe servirse exclusivamente por HTTPS (también dentro de la LAN) para cifrar el tránsito mediante TLS. No se debe implementar cifrado casero en el frontend.
4. El servidor valida la credencial contra un hash de contraseña con sal usando un algoritmo adaptativo (por ejemplo, Argon2id, bcrypt o PBKDF2), aplica límites de intentos y devuelve errores genéricos para credenciales inválidas.
5. Tras autenticar, el servidor crea una sesión protegida mediante cookie `HttpOnly`, `Secure` y `SameSite` apropiado. No devolver ni guardar tokens de sesión en `localStorage`.
6. El servidor y el cliente nunca registran contraseñas, cuerpos de autenticación, cookies ni tokens. Los registros deben limitarse a eventos operativos, códigos de estado y un identificador de correlación no sensible.

## Protección incluida en este prototipo

- Contraseña enmascarada por defecto y control accesible para mostrarla u ocultarla.
- Envío `POST`, sin credenciales en URL o query string.
- El cliente no imprime credenciales en consola y no las persiste en almacenamiento web.
- Mensajes de error genéricos, campos con límites de longitud y validación básica.
- Petición sin caché y estado de carga para evitar envíos repetidos.

## Estado de la integración local

`Serena.Api` implementa el intercambio de códigos de sesión y el registro de estudiantes. Es una API de demostración en memoria, sin autenticación docente y con HTTP. No debe usarse fuera de una red de pruebas ni con datos reales. La página `sessions.html` crea códigos sin requerir inicio de sesión.

`/api/auth/login` aún requiere un backend real. Antes de usar cuentas reales, el equipo debe implementar autenticación, TLS/HTTPS, cookies seguras, almacenamiento de hashes, protección CSRF según el mecanismo de sesión, límites de intentos, expiración y cierre de sesión. `type="password"` solo oculta la contraseña en pantalla y no cifra la comunicación.

Para verificar registros, probar en navegador y servidor con credenciales ficticias y revisar que ningún logger registre el cuerpo del `POST`, valores del formulario, cookies o tokens. Evitar capturas HAR con datos reales.
