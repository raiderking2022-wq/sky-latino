# sky latino 0.2.0: verificación

## Requisitos y límites

- Añadir catálogo de películas y series a Nuvio mediante un addon, conservando el plugin de reproducción.
- Entregar resultados al buscador mediante los extras `search` de ambos catálogos.
- Devolver metadatos y episodios observados, sin inventar capítulos ni asegurar que todo tiene video.
- Resolver una película y un episodio de serie con el extractor compartido.
- Mantener los campos visibles sin nombres ni logos de las fuentes.
- Instalar el addon requiere un servicio HTTPS público. La vista previa privada no es un enlace instalable.

## API

- Manifiesto: dos catálogos, tipos movie/series, búsqueda y paginación.
- Películas: comprobar primera y segunda página sin duplicación entre ambas.
- Series: comprobar lista real, título, metadatos y capítulos numerados.
- Buscar una película y una serie por el mismo endpoint que usa Nuvio.
- Stream de película: obtener al menos un candidato validado.
- Stream de serie: solicitar un capítulo observado y obtener un candidato validado.
- Fuera del camino feliz: id inválido, capítulo ausente, fuente bloqueada y resultado de búsqueda vacío.
- Contrato de integración: CORS público, respuestas JSON y nombres `sky latino`.

## Página de instalación

- Abrir en 1280px y 375px. Verificar nombre, pasos, advertencia de prueba y ausencia de overflow.
- Copiar URL: confirmar mensaje visible de éxito o selección manual cuando falla el portapapeles.
- Abrir manifiesto: confirmar popup/navegación con JSON correcto.
- Servicio: confirmar estado conectado; simular fallo y comprobar mensaje que impide confundirlo con instalación lista.
- Vista previa alojada: reabrir en contexto nuevo, abrir el manifiesto de prueba y comprobar que Copiar enlace esté deshabilitado hasta publicar.
- Entorno: `sites.pplx.app` y los hosts `preview--…` siempre deben indicar que la instalación pública está pendiente, nunca “Enlace público”.

## Pendientes ajenos a la prueba local

- Publicación permanente y lectura sin autenticación desde un cliente externo.
- Instalación, búsqueda y reproducción real en el Nuvio del usuario.
