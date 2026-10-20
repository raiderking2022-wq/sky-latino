# sky latino

Plugin experimental de películas para Nuvio, versión 0.1.1. La interfaz muestra únicamente el nombre `sky latino`, el idioma y la resolución comprobada, sin nombres ni logos de las plataformas de origen.

## Instalación prevista

Cuando este repositorio haya sido publicado, agregar su URL de `manifest.json` en la sección de repositorios de plugins de Nuvio. Esta es una integración de providers, no un addon Stremio; el archivo compilado se encuentra en `providers/sky-latino.js`, siguiendo el [formato de repositorios de Nuvio](https://github.com/tapframe/nuvio-providers).

La versión está habilitada para pruebas y declara únicamente películas. El runtime debe proporcionar `globalThis.TMDB_API_KEY` para consultar metadatos, según las [notas de compatibilidad de Nuvio](https://github.com/Gowaru/gowaru-nuvio-providers/blob/main/AGENTS.md); no se incluye ninguna clave privada en este repositorio.

## Estado de las pruebas

La implementación inicial pasó 32 pruebas automatizadas el 20 de octubre de 2026 y la versión renombrada se comprueba nuevamente antes de su publicación. En las pruebas reales obtuvo tres candidatos HLS para TRON: Ares y tres para Tron: El Legado; una muestra de TRON: Ares de 1920×804, con video H.264 y audio AAC, se decodificó durante tres segundos con FFmpeg.

Esto no garantiza disponibilidad futura de los servidores ni reproducción completa de las películas. La instalación y reproducción dentro del Nuvio del usuario siguen pendientes de prueba.

## Límites

- **Cobertura:** algunos reproductores dinámicos no se resuelven. El plugin devuelve una lista vacía si no puede comprobar un enlace.
- **Calidad:** se prioriza la variante más alta comprobada, pero 1920×804 no se etiqueta falsamente como 1920×1080.
- **Acceso:** no resuelve verificaciones humanas ni contenido DRM y no incluye credenciales o sesiones de terceros.
- **Datos técnicos:** se conservan los dominios y encabezados necesarios para reproducir. Solo los nombres y logos de las plataformas se ocultan en los campos visibles de Nuvio.
- **Licencias:** las dependencias incluidas en el archivo compilado tienen sus avisos en `licenses/` y `THIRD-PARTY-NOTICES.md`.

Este repositorio no aloja archivos de películas. El plugin consulta fuentes externas al momento de buscar opciones de reproducción.
