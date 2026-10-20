# Avisos de dependencias

El archivo compilado incluye `url-parse` 1.5.10 y sus dependencias `querystringify` y `requires-port`. Sus licencias originales se incluyen en el directorio `licenses/`; no se incluyen logos ni recursos visuales de las plataformas de video.

El dispositivo proporciona `cheerio-without-node-native`; el bundle nativo lo declara como dependencia externa del runtime. El backend instala Cheerio como dependencia de producción y esbuild se utiliza únicamente durante la compilación; los directorios de dependencias no se incluyen en el paquete de publicación.

El decodificador de configuraciones estáticas es código propio y no incluye scripts, claves de reproductores, recursos del sitio ni código de REA. Las muestras de HTML para pruebas se redujeron a los elementos necesarios para comprobar el parser.
