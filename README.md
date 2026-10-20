# sky latino

Versión 0.2.0, preparada para añadir catálogo, buscador y series a Nuvio. Esta revisión todavía no sustituye a la versión pública 0.1.1; requiere aprobación de publicación y una prueba posterior en el dispositivo.

## Componentes

- **Plugin nativo:** `manifest.json` y `providers/sky-latino.js`. Resuelve fuentes para películas y episodios a partir de los metadatos que proporciona Nuvio.
- **Addon de catálogo:** `server.js` y `addon/manifest.json`. Entrega listas paginadas, búsquedas, metadatos, episodios y enlaces de reproducción para títulos con identificadores propios.
- **Página de instalación:** `public/`. Explica cómo añadir el addon y muestra el enlace correspondiente al entorno; una vista previa privada no se presenta como enlace público instalable.

La descripción funcional y los límites están en `PUBLICACION.md`. Los resultados de comprobación se entregan por separado y se guardan en el directorio local `reports/`, excluido del código público.

## Desarrollo

Requiere Node.js 20 o posterior, npm y cURL. FFmpeg y FFprobe son opcionales y se usan solo para las pruebas de decodificación.

```sh
npm ci
npm test
npm run test:live
PORT=5100 npm start
```

`npm test` recompila el plugin antes de comprobar el parser, los resolvers, el contrato de addon y la integración en un contexto sin URL global. El backend no usa claves privadas ni sesiones de usuario para consultar su catálogo.

## Fuentes y compatibilidad

La implementación consulta [PelisForte](https://www2.pelisforte.se/portal003), incluidas las [series](https://www2.pelisforte.se/series-1746289646). SoloLatino y PelisGo siguen fuera del alcance de esta revisión.

El plugin nativo usa la firma `getStreams(tmdbId, mediaType, season, episode)` documentada por [el formato de providers](https://github.com/autovalue/nuvio-plugins/blob/main/DOCUMENTATION.md). La variable de metadatos `globalThis.TMDB_API_KEY` se describe en [las notas de compatibilidad del runtime](https://github.com/Gowaru/gowaru-nuvio-providers/blob/main/AGENTS.md); no se incluye ninguna clave privada.

## Seguridad y límites

La resolución sigue enlaces literales y decodifica estáticamente una familia de configuraciones empaquetadas, sin ejecutar scripts remotos, resolver verificaciones humanas ni gestionar DRM. Los episodios se obtienen de enlaces observados; no se inventan temporadas para completar listas inaccesibles.

La validación HTTP y una muestra decodificada no demuestran reproducción completa o compatibilidad en todos los dispositivos. La instalación, el buscador y la reproducción dentro del Nuvio del usuario siguen siendo comprobaciones separadas.
