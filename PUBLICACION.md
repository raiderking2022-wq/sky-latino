# sky latino

Versión 0.2.0: catálogo, búsqueda y reproducción de películas y series en Nuvio. Esta revisión añade un servicio de addon separado del plugin nativo; el enlace antiguo del plugin, por sí solo, no puede crear filas de catálogo.

## Dos piezas complementarias

- **Plugin:** `manifest.json` y `providers/sky-latino.js`. Añade fuentes de películas y episodios a títulos reconocidos por Nuvio; no crea el catálogo.
- **Addon:** `/addon/manifest.json`, servido por `server.js`. Añade las filas `sky latino · Películas` y `sky latino · Series`, acepta búsquedas del cliente y entrega metadatos, episodios y enlaces con identificadores propios.

El addon se instala en la sección de addons de Nuvio, no como repositorio de plugins. El usuario puede mantener el plugin anterior mientras prueba el catálogo.

## Qué se probó

La comprobación local del 20 de octubre de 2026 incluyó dos páginas de películas, con 20 títulos cada una y sin duplicados entre ambas, y cuatro series en el listado actual de la fuente. Esos 40 títulos son una muestra comprobada, no el límite total del catálogo; el servicio solicita páginas adicionales cuando el cliente las pide.

Las consultas `Tron` y `calamar` devolvieron resultados de películas y series. La ficha de El juego del calamar devolvió seis episodios observados de la temporada 3, y el episodio 3×1 produjo tres candidatos HLS con variantes de 1920×960.

Se ejecutaron 51 pruebas automatizadas. La prueba local del contrato de addon no demuestra todavía que el buscador, las filas y la reproducción se vean correctamente en el Nuvio del usuario; esa validación sigue pendiente después de alojar e instalar el servicio público.

## Límites

- El addon consulta una fuente externa al momento de listar y buscar. No incorpora automáticamente SoloLatino ni PelisGo y no aloja películas.
- La fuente actual solo mostró cuatro series en su listado. No se prometen series o temporadas que no se hayan podido obtener.
- Algunos capítulos y reproductores no están disponibles o requieren verificaciones que no se resuelven. Se devuelven únicamente episodios observados y enlaces que pasan las comprobaciones HTTP.
- Una ficha del catálogo no garantiza que tenga una fuente reproducible. Tampoco se garantiza disponibilidad futura de un enlace firmado.
- La interfaz muestra `sky latino`, idioma y dimensiones comprobadas. No incluye nombres ni logos de las páginas de origen; los dominios técnicos necesarios permanecen en el código y las solicitudes.

## Ejecutar el servicio

Requiere Node.js 20 o posterior y cURL. El servicio no necesita claves TMDB ni sesiones de usuario para su catálogo y sus identificadores propios.

```sh
npm ci
npm run build
npm test
PORT=5100 npm start
```

El plugin nativo sí utiliza los metadatos que proporciona el runtime de Nuvio mediante `globalThis.TMDB_API_KEY`. No se distribuye ninguna clave privada.

## Publicación

El código incluye una configuración de Vercel y una página de instalación mínima. Un manifiesto alojado como archivo estático en GitHub no puede responder por sí solo a consultas dinámicas de catálogo, búsqueda y episodios; hace falta alojar el proceso de Node.js.

La vista previa privada no es un enlace instalable desde Nuvio. La publicación permanente de esta revisión, la lectura sin autenticación y la prueba en el dispositivo se deben verificar por separado.
