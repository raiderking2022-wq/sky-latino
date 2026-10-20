'use strict';
require('../scripts/node-runtime');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('../src/html');
const { createExtractor } = require('../src/extractor');
const base = h.BASE;
const movie = base + '/pelicula/prueba-2020-123';
const wrapper = 'https://mp4.nu/?h=public-token';
const host = 'https://player.example.com/embed/abc';
const cdn = 'https://cdn.example.com/master.m3u8';
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720.m3u8';
const playlist = '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts\n#EXT-X-ENDLIST';
const page = '<h1>Prueba</h1><a href="#options-0">OPCIÓN 1 BYSE ESPAÑOL LATINO</a>' +
  '<div id="options-0"><iframe data-src="' + wrapper + '"></iframe></div>';

function response(url, body, type, status) {
  return {
    url, status: status || 200, ok: !status || status === 200,
    headers: { get: key => key === 'content-type' ? type || 'text/html' : null },
    text: () => Promise.resolve(body || '')
  };
}
function network(routes, calls) {
  return function (url, init) {
    if (calls) calls.push({ url, init });
    const entry = routes[url];
    if (typeof entry === 'function') return Promise.resolve(entry(url, init));
    if (!entry) return Promise.resolve(response(url, 'not found', 'text/html', 404));
    return Promise.resolve(response(url, entry.body, entry.type, entry.status));
  };
}
function goodRoutes() {
  return {
    [movie]: { body: page },
    [wrapper]: { body: '<script>window.location.replace("' + host + '");</script>' },
    [host]: { body: '<video><source src="' + cdn + '" type="application/x-mpegURL"></video>' },
    [cdn]: { body: master, type: 'application/vnd.apple.mpegurl' },
    'https://cdn.example.com/1080.m3u8': { body: playlist, type: 'application/vnd.apple.mpegurl' },
    'https://cdn.example.com/seg.ts': { type: 'video/mp2t' }
  };
}

test('URL vacía o ausente no se convierte en la portada', () => {
  assert.equal(h.safeURL('', base), null);
  assert.equal(h.safeURL(undefined, base), null);
});
test('bloquea esquemas, credenciales, puertos y direcciones locales', () => {
  ['javascript:alert(1)', 'file:///etc/passwd', 'http://127.0.0.1/a',
    'http://2130706433/a', 'http://127.1/a', 'http://0x7f.1/a',
    'http://[::1]/a', 'https://x.local/a',
    'https://user:password@example.com/a', 'https://example.com:8080/a']
    .forEach(u => assert.equal(h.safeURL(u, base), null, u));
});
test('resuelve rutas relativas y entidades HTML', () => {
  assert.equal(h.safeURL('/video?id=1&amp;x=2', base), base + '/video?id=1&x=2');
});
test('lee dos opciones e idiomas del HTML real', () => {
  const parsed = h.playerOptions(fixture('ex-machina.html'), base);
  assert.equal(parsed.title, 'Ex Machina');
  assert.deepEqual(parsed.options.map(o => o.language), ['Latino', 'Castellano']);
  assert.equal(parsed.options.length, 2);
  assert.ok(parsed.options.every(o => o.url.startsWith('https://mp4.nu/?h=')));
});
test('extrae título, año y URL de resultados reales', () => {
  const results = h.searchResults(fixture('tron-search.html'), base);
  const tron = results.find(r => r.title === 'TRON: Ares');
  assert.ok(tron);
  assert.equal(tron.year, 2025);
  assert.match(tron.url, /tron-ares-2025/);
});
test('no confunde secuelas o años incompatibles', () => {
  const matches = h.rankResults([
    { title: 'Tron', year: 1982 }, { title: 'Tron: El Legado', year: 2010 },
    { title: 'TRON: Ares', year: 2025 }
  ], { titles: ['TRON: Ares'], year: 2025 });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, 'TRON: Ares');
});
test('normaliza tildes sin inventar coincidencias', () => {
  assert.equal(h.normalize('  Misión: Imposible '), 'mision imposible');
  assert.equal(h.rankResults([{ title: 'Otra película', year: 2020 }], { title: 'Prueba', year: 2020 }).length, 0);
});
test('extrae redirecciones literales sin ejecutar JavaScript', () => {
  global.__executed = false;
  const urls = h.followLinks('<script>global.__executed=true;window.location.replace("' + host + '")</script>', wrapper);
  assert.deepEqual(urls, [host]);
  assert.equal(global.__executed, false);
  delete global.__executed;
});
test('acepta iframe y meta refresh relativos, sin duplicados', () => {
  assert.deepEqual(h.followLinks('<iframe src="/e/x"></iframe><meta http-equiv="refresh" content="0; url=/e/x">', 'https://player.example.com'), ['https://player.example.com/e/x']);
});
test('no interpreta expresiones JS como enlaces resueltos', () => {
  assert.deepEqual(h.followLinks('<script>location.replace(decrypt("x"))</script>', wrapper), []);
});
test('distingue eliminado, challenge y fuente no disponible', () => {
  assert.equal(h.stopReason('Video Removed'), 'removed');
  assert.equal(h.stopReason('Verify you are human'), 'challenge');
  assert.equal(h.stopReason('Video source is unavailable.'), 'unavailable');
});
test('HLS obtiene resolución declarada en el manifiesto, no en la ficha', () => {
  const parsed = h.parseHLS(master, cdn);
  assert.equal(parsed.variants[0].height, 1080);
  assert.equal(parsed.variants[0].url, 'https://cdn.example.com/1080.m3u8');
});
test('rechaza HTML disfrazado de HLS y DRM', () => {
  assert.throws(() => h.parseHLS('<html>1080p</html>', cdn), /invalid_hls/);
  assert.throws(() => h.parseHLS('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\na.ts', cdn), /drm_unsupported/);
});
test('resuelve ficha, wrapper, host, HLS y comprueba el segmento', async () => {
  const calls = [];
  const result = await createExtractor({ fetch: network(goodRoutes(), calls) }).inspect(movie);
  assert.equal(result.streams.length, 1);
  assert.equal(result.streams[0].quality, '1080p');
  assert.equal(result.streams[0].url, 'https://cdn.example.com/1080.m3u8');
  assert.equal(result.streams[0].headers.Referer, host);
  assert.ok(calls.some(c => c.url.endsWith('/seg.ts') && c.init.method === 'HEAD'));
});
test('no expone nombres ni logos de plataformas en los campos visibles', async () => {
  const result = await createExtractor({ fetch: network(goodRoutes()) }).inspect(movie);
  const stream = result.streams[0];
  assert.equal(stream.name, 'sky latino');
  assert.doesNotMatch(stream.name + ' ' + stream.title, /pelisforte|byse|okhd|mp4\.nu/i);
  assert.equal(stream.logo, undefined);
  assert.match(stream.title, /Latino/);
});
test('un iframe no se devuelve como stream si no produce medio válido', async () => {
  const routes = goodRoutes();
  routes[host] = { body: '<html><div>Video Removed</div></html>' };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.deepEqual(result.streams, []);
  assert.ok(result.diagnostics.some(d => d.status === 'removed'));
});
test('descarta video que exige verificación humana', async () => {
  const routes = goodRoutes();
  routes[host] = { body: "<p>Click play button in order to verify you're a human</p>" };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 0);
  assert.ok(result.diagnostics.some(d => d.status === 'challenge'));
});
test('no confunde ruta embed terminada en .mp4 con archivo directo', async () => {
  const routes = goodRoutes();
  routes[wrapper] = { body: '<iframe src="https://player.example.com/e/x/film.mp4"></iframe>' };
  routes['https://player.example.com/e/x/film.mp4'] = { body: '<html>not a video</html>' };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 0);
});
test('descarta segmento HLS inaccesible aunque el manifiesto exista', async () => {
  const routes = goodRoutes();
  routes['https://cdn.example.com/seg.ts'] = { status: 403 };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 0);
});
test('descarta falso MP4 cuya respuesta es HTML', async () => {
  const routes = goodRoutes();
  routes[host] = { body: '<video src="https://cdn.example.com/video.mp4"></video>' };
  routes['https://cdn.example.com/video.mp4'] = { body: '<html>error</html>', type: 'text/html' };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 0);
});
test('MP4 aceptado por MIME no recibe resolución inventada', async () => {
  const routes = goodRoutes();
  routes[host] = { body: '<video src="https://cdn.example.com/video.mp4"></video><p>1080-HD</p>' };
  routes['https://cdn.example.com/video.mp4'] = { type: 'video/mp4' };
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams[0].quality, 'Calidad no verificada');
});
test('no descarga la película si HEAD es rechazado', async () => {
  const calls = [];
  const routes = goodRoutes();
  routes[host] = { body: '<video src="https://cdn.example.com/video.mp4"></video>' };
  routes['https://cdn.example.com/video.mp4'] = { status: 405 };
  const result = await createExtractor({ fetch: network(routes, calls) }).inspect(movie);
  assert.equal(result.streams.length, 0);
  assert.ok(calls.filter(c => c.url.endsWith('/video.mp4')).every(c => c.init.method === 'HEAD'));
});
test('no entra en ciclos de iframes', async () => {
  const calls = [];
  const routes = goodRoutes();
  routes[host] = { body: '<iframe src="' + wrapper + '"></iframe>' };
  const result = await createExtractor({ fetch: network(routes, calls) }).inspect(movie);
  assert.equal(result.streams.length, 0);
  assert.ok(calls.length <= 4);
});
test('no acepta fichas arbitrarias fuera del sitio', async () => {
  await assert.rejects(createExtractor({ fetch: network({}) }).inspect('https://other.example.com/pelicula/x'), /invalid_movie_page/);
});
test('errores de una opción no cancelan las opciones restantes', async () => {
  const routes = goodRoutes();
  routes[movie].body += '<a href="#options-1">Castellano</a><div id="options-1"><iframe src="https://player.example.com/dead"></iframe></div>';
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 1);
  assert.ok(result.diagnostics.some(d => d.status === 'http_404'));
});
test('el plugin devuelve vacío para series y si no recibe la clave del runtime', async () => {
  const { getStreams } = require('../src/index');
  assert.deepEqual(await getStreams('264660', 'tv', 1, 1), []);
  assert.deepEqual(await getStreams('264660', 'movie'), []);
});
test('el bundle no necesita URL ni temporizadores de navegador', async () => {
  const vm = require('node:vm');
  const routes = goodRoutes();
  routes['https://api.themoviedb.org/3/movie/264660?language=es-MX&api_key=test-runtime-only&append_to_response=alternative_titles'] = function (url) {
    return { url, status: 200, ok: true, json: () => Promise.resolve({
      title: 'Prueba', original_title: 'Prueba', release_date: '2020-01-01'
    }) };
  };
  routes[base + '/?s=Prueba'] = { body: '<article><h2>Prueba</h2><span>2020</span><a href="' + movie + '"></a></article>' };
  const context = { module: { exports: {} }, TMDB_API_KEY: 'test-runtime-only',
    fetch: network(routes), require: id => {
      assert.equal(id, 'cheerio-without-node-native');
      return require('cheerio');
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../providers/sky-latino.js'), 'utf8'), context);
  const streams = await context.module.exports.getStreams('264660', 'movie');
  assert.equal(streams.length, 1);
  assert.equal(streams[0].quality, '1080p');
});
test('lee configuración empaquetada sin ejecutar scripts', () => {
  const { unpack } = require('../src/unpack');
  const packed = `eval(function(p,a,c,k,e,d){return p}('0("1").2({3:[{4:"https://cdn.example.com/master.m3u8"}]})',36,5,'jwplayer|x|setup|sources|file'.split('|')))`;
  const decoded = unpack(packed);
  assert.equal(decoded.length, 1);
  assert.deepEqual(h.mediaLinks(decoded[0], host), [cdn]);
});
test('las expresiones no literales del empaquetador no se ejecutan', () => {
  const { unpack } = require('../src/unpack');
  assert.deepEqual(unpack(`eval(function(){return p}(stealCookies(),36,5,'a|b'.split('|')))`), []);
});
test('resuelve un reproductor empaquetado hasta la validación HTTP', async () => {
  const routes = goodRoutes();
  routes[host].body = `eval(function(p,a,c,k,e,d){return p}('0({1:[{2:"https://cdn.example.com/master.m3u8"}]})',36,3,'setup|sources|file'.split('|')))`;
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams.length, 1);
  assert.ok(result.diagnostics.some(d => d.status === 'static_dictionary'));
});
test('prioriza la variante más alta sin etiquetar 804p como 1080p', async () => {
  const routes = goodRoutes();
  routes[cdn].body = master.replace('1920x1080', '1920x804');
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams[0].quality, '804p');
  assert.match(result.streams[0].title, /1920×804/);
  assert.equal(result.streams[0].url, 'https://cdn.example.com/1080.m3u8');
});
test('conserva el master si hay audio externo para no perder sonido', async () => {
  const routes = goodRoutes();
  routes[cdn].body = master.replace('#EXTM3U', '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="audio.m3u8"');
  const result = await createExtractor({ fetch: network(routes) }).inspect(movie);
  assert.equal(result.streams[0].url, cdn);
  assert.match(result.streams[0].title, /Hasta 1920×1080/);
});
