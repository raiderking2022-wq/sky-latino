# sky latino 0.3.0

Actualización preparada para buscar títulos en inglés y utilizar el icono azul de sky latino. Conserva los catálogos de películas y series y el enlace de instalación del addon; los usuarios existentes podrían necesitar actualizar o volver a añadir el mismo manifiesto para que Nuvio registre el nuevo logo y el prefijo de identificadores IMDb.

## Búsqueda y reproducción

Cuando el resultado de la fuente utiliza un nombre español, la tarjeta puede mostrar también su título original inglés verificado. Por ejemplo, la comprobación local relacionó `Squid Game` con `El juego del calamar`, y `Project Hail Mary` con `Proyecto Fin del Mundo`.

Además, el addon puede resolver resultados generales con identificadores IMDb. Coteja el nombre de los metadatos públicos con los nombres y alias de la fuente, y no acepta un año incompatible o una secuela con otro número.

## Icono azul

La imagen se integra como `logo` en el manifiesto del addon y en el del plugin. Es una identidad propia de sky latino; no contiene logos de las plataformas utilizadas como fuentes.

## Protección del servicio

- El transporte del servidor solo conecta a direcciones IPv4 públicas comprobadas por DNS y fijadas durante la conexión. Cada redirección se valida de nuevo; no utiliza proxies ni configuración externa de cURL.
- Los límites de solicitudes no confían en cabeceras enviadas por el cliente. Se permiten como máximo cuatro tareas de consulta distintas simultáneas por proceso.
- Detrás de un proxy, los clientes pueden compartir un límite conservador. Estos controles por proceso no sustituyen una protección distribuida de infraestructura ante ataques de volumen.

## Límites que permanecen

- Solo se obtiene video de la fuente integrada; buscar en inglés no añade bibliotecas de contenido nuevas.
- Los servidores dinámicos no soportados y las temporadas bloqueadas siguen sin estar disponibles.
- El puente general cubre identificadores IMDb. Otros formatos de identificador dependen del soporte de Nuvio o del plugin nativo.
- La imagen y estos cambios no aparecen en el servicio público hasta publicar esta revisión.
- Las pruebas del servicio no sustituyen la comprobación del buscador y la reproducción dentro del dispositivo del usuario.
