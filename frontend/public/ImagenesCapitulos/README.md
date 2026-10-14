# Portadas de los capítulos

Cada capítulo usa una portada ubicada en su carpeta correspondiente. Esa portada se aplica automáticamente a todas las narrativas de ese capítulo:

`ImagenesCapitulos/Capitulo N/`

Por ejemplo, una imagen llamada `aula-compasiva.webp` dentro de `ImagenesCapitulos/Capitulo 1/` se mostrará en las ocho tarjetas del capítulo 1.

El nombre es libre. Se admite una imagen `.avif`, `.gif`, `.jpeg`, `.jpg`, `.png` o `.webp` por carpeta. Si hay varias, se usa la primera por orden alfabético. Mientras una portada no exista, el catálogo mostrará el fondo oscuro de reserva.

Para que se detecten automáticamente los cambios, inicia Serena con `Serena.Launcher` o con los tres servicios de `GUIA-USO.md`, incluido el backend Node. El catálogo se comunica con él mediante el proxy de Vite, por lo que funciona aunque Vite use un puerto diferente de `5173`.
