'use strict';
require('../scripts/node-runtime');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const h = require('../src/html');
const { createSource } = require('../src/source');
const { createExtractor } = require('../src/extractor');
const { parseStandardID, createStandardResolver } = require('../backend/standard-ids');
const { createHandler } = require('../server');
const base = h.BASE;
const series = base + '/serie/el-juego-del-calamar-1751082264';
const episode = base + '/episodio/el-juego-del-calamar-3x1';
const movie = base + '/pelicula/proyecto-fin-del-mundo-2026-1777860739';
const seriesPage = `<h1>El juego del calamar</h1><p>Disfruta de esta serie, también conocida por los títulos:</p><p>Squid Game.</p><ul id="episode_by_temp"><li><article class="episodes"><h2>El juego del calamar 3x1</h2><a href="${episode}"></a></article></li></ul>`;
const moviePage = '<h1>Proyecto Fin del Mundo</h1><p>Disfruta de esta película, también conocida por los títulos:</p><p>Proyecto Salvación.<br />Project Hail Mary.</p>';
function response(url, body, type, status) {
  return { url, status: status || 200, ok: !status || status === 200,
    headers: { get: name => name === 'content-type' ? type || 'text/html' : null },
    text: () => Promise.resolve(body) };
}
function routes(url, init) {
  if (url === 'https://v3-cinemeta.strem.io/meta/series/tt10919420.json')
    return response(url, JSON.stringify({ meta: { id: 'tt10919420', name: 'Squid Game', year: 2021 } }), 'application/json');
  if (url.includes('?s=Squid')) return response(url, `<article><h2>El juego del calamar</h2><span>2021</span><a href="${series}"></a></article>`);
  if (url.includes('?s=Project')) return response(url, `<article><h2>Proyecto Fin del Mundo</h2><span>2026</span><a href="${movie}"></a></article>`);
  if (url === series) return response(url, seriesPage);
  if (url === movie) return response(url, moviePage);
  if (url === episode) return response(url, '<h1>El juego del calamar 3x1</h1><a href="#options-0">Latino</a><div id="options-0"><iframe src="https://player.example.com/e/squid"></iframe></div>');
  if (url === 'https://player.example.com/e/squid') return response(url, '<video src="https://media.example.com/master.m3u8"></video>');
  if (url === 'https://media.example.com/master.m3u8') return response(url, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x960\nhigh.m3u8', 'application/vnd.apple.mpegurl');
  if (url === 'https://media.example.com/high.m3u8') return response(url, '#EXTM3U\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST', 'application/vnd.apple.mpegurl');
  if (url === 'https://media.example.com/segment.ts') return response(url, '', 'video/mp2t');
  return response(url, 'not found', 'text/html', 404);
}
test('extrae los títulos alternativos de la fuente, no de recomendaciones', () => {
  assert.deepEqual(h.alternativeTitles(moviePage), ['Proyecto Salvación', 'Project Hail Mary']);
  assert.deepEqual(h.alternativeTitles('<p>Recomendaciones</p><p>Squid Game</p>'), []);
});
test('compara el título inglés con un alias verificado', () => {
  const ranked = h.rankResults([{ title: 'Proyecto Fin del Mundo', year: 2026, aliases: ['Project Hail Mary'] }],
    { titles: ['Project Hail Mary'], year: 2026 });
  assert.equal(ranked.length, 1);
});
test('un alias de otro año no convierte otra película en coincidencia', () => {
  assert.equal(h.rankResults([{ title: 'Otro título', year: 2000, aliases: ['Project Hail Mary'] }],
    { titles: ['Project Hail Mary'], year: 2026 }).length, 0);
});
test('no confunde una secuela por coincidencia parcial larga', () => {
  assert.equal(h.rankResults([{ title: 'The Long Journey Through Space', year: 2026 }],
    { titles: ['The Long Journey Through Space 2'], year: 2026 }).length, 0);
});
test('búsqueda muestra título español y alias inglés en la misma tarjeta', async () => {
  const source = createSource({ fetch: async (...args) => routes(...args) });
  const items = await source.catalog('series', 'Squid Game', 0);
  assert.equal(items[0].name, 'El juego del calamar / Squid Game');
  assert.equal(items[0].id, 'sky:s:el-juego-del-calamar-1751082264');
});
test('la consulta no se utiliza como traducción inventada', async () => {
  const source = createSource({ fetch: async (url) => url.includes('?s=')
    ? response(url, `<article><h2>Otro título</h2><a href="${movie}"></a></article>`)
    : response(url, '<h1>Otro título</h1>') });
  assert.equal((await source.catalog('movie', 'Unverified English Title', 0))[0].name, 'Otro título');
});
test('valida el alias de la ficha antes de enlazar una búsqueda inglesa', async () => {
  const matches = await createExtractor({ fetch: async (...args) => routes(...args) })
    .search({ titles: ['Project Hail Mary'], year: 2026, type: 'movie' });
  assert.equal(matches[0].url, movie);
  assert.ok(matches[0].aliases.includes('Project Hail Mary'));
});
test('la extracción de una serie en inglés llega al capítulo y al HLS', async () => {
  const result = await createExtractor({ fetch: async (...args) => routes(...args) })
    .extract({ titles: ['Squid Game'], year: 2021, type: 'series', season: 3, episode: 1 });
  assert.equal(result.streams.length, 1);
  assert.equal(result.streams[0].quality, '960p');
});
test('IMDb admite película o episodio, no URL ni episodio inexistente', () => {
  assert.equal(parseStandardID('tt0816692', 'movie').imdb, 'tt0816692');
  assert.equal(parseStandardID('tt10919420:3:1', 'series').episode, 1);
  assert.equal(parseStandardID('tt10919420', 'series'), null);
  assert.equal(parseStandardID('tt10919420:0:1', 'series'), null);
  assert.equal(parseStandardID('tt0816692:1:1', 'movie'), null);
  assert.equal(parseStandardID('https://example.com', 'movie'), null);
});
test('metadatos públicos de IMDb no requieren una clave y se cachean', async () => {
  let count = 0;
  const resolver = createStandardResolver(async (...args) => { count++; return routes(...args); });
  const parsed = parseStandardID('tt10919420:3:1', 'series');
  assert.equal((await resolver(parsed)).titles[0], 'Squid Game');
  assert.equal((await resolver(parsed)).year, 2021);
  assert.equal(count, 1);
});
test('rechaza un identificador de metadatos que no corresponde al solicitado', async () => {
  const resolver = createStandardResolver(async url => response(url, JSON.stringify({ meta: { id: 'tt9999999', name: 'Other' } })));
  await assert.rejects(resolver(parseStandardID('tt0816692', 'movie')), /metadata_unavailable/);
});
test('el manifiesto anuncia resultados generales IMDb y el icono azul', () => {
  const addon = require('../addon/manifest.json');
  const plugin = require('../manifest.json');
  assert.ok(addon.idPrefixes.includes('tt'));
  assert.ok(addon.logo.includes('sky-latino-icon.png'));
  assert.equal(plugin.scrapers[0].logo, addon.logo);
});
test('API resuelve el resultado general IMDb, no solo el catálogo sky:', async t => {
  const server = http.createServer(createHandler({ fetch: async (...args) => routes(...args) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = 'http://127.0.0.1:' + server.address().port;
  const result = await fetch(root + '/addon/stream/series/tt10919420:3:1.json');
  const json = await result.json();
  assert.equal(result.status, 200);
  assert.equal(json.streams.length, 1);
  assert.equal(json.streams[0].quality, '960p');
});
