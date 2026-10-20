# sky latino

Revisión 0.3.0 preparada para mejorar los títulos en inglés e incorporar el icono azul solicitado. La versión pública anterior es 0.2.0; esta revisión necesita aprobación y publicación antes de estar disponible en el Nuvio del usuario.

## Cambios de esta revisión

- **Buscador bilingüe:** cuando la fuente muestra un título español, la tarjeta de búsqueda puede incluir su nombre inglés verificado. No se traduce ni se inventa un título a partir de lo escrito por el usuario.
- **Identificadores generales:** el addon admite streams con identificadores IMDb, además de sus identificadores `sky:`. La metadata de esos identificadores se consulta públicamente, sin claves privadas, y se coteja con las fichas de la fuente.
- **Nombres alternativos:** el extractor verifica los alias publicados en la ficha y el año. El plugin nativo también solicita los títulos alternativos que expone la metadata del runtime.
- **Icono:** el manifiesto del addon y el del plugin apuntan al icono azul propio, servido desde `public/assets/sky-latino-icon.png`.

## Componentes

- **Plugin nativo:** `manifest.json` y `providers/sky-latino.js`. Fuentes de películas y episodios para títulos reconocidos por Nuvio.
- **Addon:** `server.js` y `addon/manifest.json`. Catálogos paginados, búsqueda, metadatos, episodios y enlaces. El nuevo prefijo IMDb se anuncia para streams; los metadatos propios siguen restringidos a `sky:`.
- **Instalación:** `public/` contiene la página informativa y el icono. La URL pública del catálogo se mantiene; una vista previa no debe instalarse como si fuera el servicio publicado.

## Desarrollo

Requiere Node.js 20 o posterior, npm y cURL. FFmpeg y FFprobe son opcionales para pruebas de decodificación.

```sh
npm ci
npm test
PORT=5100 npm start
```

`npm test` recompila el plugin y comprueba coincidencias, validaciones de video, contrato del addon, búsquedas inglesas y reproducción desde identificadores generales. La validación dentro del Nuvio del usuario sigue siendo una comprobación separada.

## Alcance y privacidad

La fuente integrada sigue siendo [PelisForte](https://www2.pelisforte.se/portal003), con las [series de su listado](https://www2.pelisforte.se/series-1746289646). El nuevo puente de identificadores consulta [metadatos públicos de Cinemeta](https://v3-cinemeta.strem.io/meta/movie/tt0816692.json); esto no añade nuevas bibliotecas de video.

Un título solo tendrá enlaces si la fuente contiene una coincidencia verificable y el servidor de video responde. No se incluyen cuentas, sesiones, claves privadas, archivos de películas ni técnicas para resolver verificaciones humanas.
