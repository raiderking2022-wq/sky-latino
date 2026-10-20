'use strict';
require('../scripts/node-runtime');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const c = require('../src/catalog-html');
const { createSource } = require('../src/source');
const { createHandler } = require('../server');
const { parseResponse } = require('../backend/fetch');
const { BASE } = require('../src/html');
const series = BASE + '/serie/serie-ejemplo-2020-1234567890';
const episode = BASE + '/episodio/serie-ejemplo-2x1';
const sid = 'sky:s:serie-ejemplo-2020-1234567890';
const movie = BASE + '/pelicula/pelicula-ejemplo-2020-1234567890';
const mid = 'sky:m:pelicula-ejemplo-2020-1234567890';
const card = (url, name, year) => `<article><h2 class="entry-title">${name}</h2><span class="year">${year}</span><img src="https://images.example.com/poster.jpg"><a href="${url}"></a></article>`;
const episodeFragment = `<li><article class="episodes"><h2>Serie ejemplo 2x1</h2><a href="${episode}"></a></article></li>`;
const seriesHTML = `<html><head><title>Ver Serie ejemplo (2020)</title></head><body><h1>Serie ejemplo</h1><div class="description">Historia de ejemplo.</div><img src="/logo.png"><div class="post-thumbnail"><img src="https://images.example.com/poster.jpg"></div><a data-season="2" data-post="123"></a><a data-season="1" data-post="123"></a><ul id="episode_by_temp">${episodeFragment}</ul><script>var torofilm_public = {"url":"${BASE}/wp-admin/admin-ajax.php","nonce":"public-example"};</script></body></html>`;
function response(url, body, status) {
  return { status: status || 200, ok: !status || status === 200, url,
    headers: { get: () => 'text/html' }, text: () => Promise.resolve(body) };
}
function sourceMock(extra) {
  return createSource({ fetch: (url, init) => {
    if (extra) { const found = extra(url, init); if (found) return Promise.resolve(found); }
    if (url === series) return Promise.resolve(response(url, seriesHTML));
    if (url.includes('admin-ajax.php')) return Promise.resolve(response(url, '0', 403));
    if (url === BASE + '/portal003') return Promise.resolve(response(url, '<ul class="post-lst">' + card(movie, 'Película ejemplo', 2020) + '</ul>'));
    if (url === BASE + '/series-1746289646') return Promise.resolve(response(url, '<ul class="post-lst">' + card(series, 'Serie ejemplo', 2020) + '</ul>'));
    return Promise.resolve(response(url, '404', 404));
  } });
}
test('catálogo excluye publicidad externa y separa películas y series', () => {
  const html = '<ul class="post-lst">' + card('https://ads.example.com/netflix', 'Netflix Premium', 2026) +
    card(movie, 'Película ejemplo', 2020) + card(series, 'Serie ejemplo', 2020) + '</ul>';
  assert.equal(c.cards(html, BASE, 'movie').items.length, 1);
  assert.equal(c.cards(html, BASE, 'series').items.length, 1);
  assert.equal(c.cards(html, BASE, 'movie').items[0].meta.id, mid);
});
test('las recomendaciones no se mezclan con los resultados principales', () => {
  const html = '<ul class="post-lst">' + card(movie, 'Resultado', 2020) + '</ul>' + card(BASE + '/pelicula/otra-2020', 'Recomendación', 2020);
  assert.equal(c.cards(html, BASE, 'movie').items.length, 1);
});
test('no utiliza imágenes de marca como póster', () => {
  const html = '<ul class="post-lst">' + card(movie, 'Ejemplo', 2020).replace('https://images.example.com/poster.jpg', BASE + '/fbpf.jpg') + '</ul>';
  assert.equal(c.cards(html, BASE, 'movie').items[0].meta.poster, undefined);
});
test('identificadores propios no permiten rutas arbitrarias', () => {
  assert.equal(c.parseID('sky:m:../../etc/passwd'), null);
  assert.equal(c.parseID('sky:m:slug:2:1'), null);
  assert.equal(c.parseID('https://example.com'), null);
  assert.equal(c.parseID(sid + ':2:1').season, 2);
});
test('extrae episodios observados, no capítulos inventados', () => {
  const parsed = c.detail(seriesHTML, series, 'series');
  assert.equal(parsed.meta.videos.length, 1);
  assert.equal(parsed.meta.videos[0].id, sid + ':2:1');
  assert.deepEqual(parsed.seasons, [2, 1]);
  assert.equal(parsed.episodes[0].url, episode);
});
test('no mezcla enlaces de otra serie fuera de la lista de episodios', () => {
  const html = seriesHTML + '<a href="' + BASE + '/episodio/otra-serie-1x1">Recomendación</a>';
  assert.equal(c.episodeLinks(html, series, sid).length, 1);
});
test('elimina el nombre de origen de la descripción visible', () => {
  assert.equal(c.cleanDescription('Ver en PelisForte'), 'Ver en sky latino');
});
test('catálogos devuelven películas y series sin clave TMDB', async () => {
  const source = sourceMock();
  assert.equal((await source.catalog('movie', '', 0))[0].id, mid);
  assert.equal((await source.catalog('series', '', 0))[0].id, sid);
});
test('búsqueda envía la consulta real y conserva acentos', async () => {
  let observed;
  const source = sourceMock((url) => {
    if (url.includes('?s=')) { observed = url; return response(url, '<ul class="post-lst">' + card(movie, 'Misión', 2020) + '</ul>'); }
  });
  assert.equal((await source.catalog('movie', 'Misión imposible', 0)).length, 1);
  assert.match(observed, /\?s=Misi%C3%B3n%20imposible/);
});
test('carga páginas posteriores del catálogo de películas', async () => {
  let observed;
  const source = sourceMock(url => {
    if (url.includes('/page/2')) { observed = url; return response(url, '<ul class="post-lst">' + card(movie, 'Página 2', 2020) + '</ul>'); }
  });
  assert.equal((await source.catalog('movie', '', 20))[0].name, 'Página 2');
  assert.match(observed, /todas-las-peliculas\/page\/2$/);
});
test('no inventa una segunda página de series si no existe', async () => {
  assert.deepEqual(await sourceMock().catalog('series', '', 20), []);
  assert.deepEqual(await sourceMock().catalog('series', '', 1), []);
});
test('temporadas bloqueadas no hacen desaparecer episodios disponibles', async () => {
  const meta = await sourceMock().metadata(sid);
  assert.equal(meta.videos.length, 1);
  assert.equal(meta.videos[0].season, 2);
});
test('reproducción de serie selecciona URL real del capítulo', async () => {
  assert.equal(await sourceMock().playbackPage(sid + ':2:1'), episode);
});
test('episodio ausente no se transforma en una URL inventada', async () => {
  await assert.rejects(sourceMock().playbackPage(sid + ':2:99'), /episode_unavailable/);
});
test('una respuesta AJAX válida añade otra temporada', async () => {
  const source = sourceMock(url => url.includes('admin-ajax.php') ? response(url, episodeFragment.replaceAll('2x1', '1x1')) : null);
  const meta = await source.metadata(sid);
  assert.deepEqual(meta.videos.map(v => v.season), [1, 2]);
  assert.equal(await source.playbackPage(sid + ':1:1'), episode.replace('2x1', '1x1'));
});
test('el transporte separa las cabeceras CONNECT de la respuesta real', () => {
  const result = parseResponse('HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 200\r\ncontent-type: text/html\r\n\r\nhello\nmarker200\nhttps://example.com', '\nmarker');
  assert.equal(result.payload, 'hello');
  assert.equal(result.headers['content-type'], 'text/html');
  assert.equal(result.status, 200);
});
test('el manifiesto del addon declara búsqueda en ambos catálogos', () => {
  const manifest = require('../addon/manifest.json');
  assert.equal(manifest.name, 'sky latino');
  assert.deepEqual(manifest.types, ['movie', 'series']);
  assert.equal(manifest.catalogs.length, 2);
  assert.ok(manifest.catalogs.every(catalog => catalog.extra.some(e => e.name === 'search' && !e.isRequired)));
  assert.ok(manifest.resources.includes('stream'));
});
test('API: manifiesto, catálogos, búsqueda, metadatos y entradas inválidas', async t => {
  const calls = [];
  const source = {
    catalog: async (...args) => { calls.push(args); return [{ id: mid, type: 'movie', name: 'Prueba' }]; },
    metadata: async () => ({ id: sid, type: 'series', name: 'Prueba', videos: [{ id: sid + ':2:1', season: 2, episode: 1 }] }),
    playbackPage: async () => { throw new Error('unavailable'); }
  };
  const server = http.createServer(createHandler({ source }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const manifest = await fetch(url + '/addon/manifest.json');
  assert.equal(manifest.headers.get('access-control-allow-origin'), '*');
  assert.equal((await manifest.json()).catalogs.length, 2);
  assert.equal((await fetch(url + '/addon/catalog/movie/sky-movies/search=Tron&skip=20.json')).status, 200);
  assert.deepEqual(calls[0], ['movie', 'Tron', 20]);
  assert.equal((await fetch(url + '/addon/catalog/movie/sky-movies/search=R%C3%A1pidos%20%26%20Furiosos.json')).status, 200);
  assert.deepEqual(calls[1], ['movie', 'Rápidos & Furiosos', 0]);
  assert.equal((await fetch(url + '/addon/catalog/series/sky-series.json')).status, 200);
  assert.equal((await fetch(url + '/addon/meta/series/' + sid + '.json')).status, 200);
  assert.equal((await fetch(url + '/addon/meta/series/' + encodeURIComponent(sid) + '.json')).status, 200);
  const stream = await fetch(url + '/addon/stream/series/' + sid + ':2:1.json');
  assert.deepEqual(await stream.json(), { streams: [] });
  assert.equal((await fetch(url + '/addon/catalog/movie/sky-series.json')).status, 404);
  assert.equal((await fetch(url + '/addon/catalog/movie/sky-movies/skip=-1.json')).status, 400);
  assert.equal((await fetch(url + '/addon/meta/movie/not-an-id.json')).status, 404);
  assert.equal((await fetch(url + '/addon/catalog/movie/sky-movies.json', { method: 'POST' })).status, 405);
});
test('plugin nativo también resuelve series en el runtime sin URL global', async () => {
  const calls = [];
  const fetcher = function (url) {
    calls.push(url);
    if (url.includes('api.themoviedb.org/3/tv/')) return Promise.resolve({
      ok: true, json: () => Promise.resolve({ name: 'Serie ejemplo', original_name: 'Serie ejemplo', first_air_date: '2020-01-01' })
    });
    if (url.includes('?s=')) return Promise.resolve(response(url, '<ul class="post-lst">' + card(series, 'Serie ejemplo', 2020) + '</ul>'));
    if (url === series) return Promise.resolve(response(url, seriesHTML));
    if (url === episode) return Promise.resolve(response(url, '<h1>2x1</h1><a href="#options-0">Latino</a><div id="options-0"><iframe src="https://player.example.com/e/x"></iframe></div>'));
    if (url.includes('player.example.com')) return Promise.resolve(response(url, 'Video Removed'));
    throw new Error('unexpected_url');
  };
  const context = { module: { exports: {} }, TMDB_API_KEY: 'test-only', fetch: fetcher,
    require: id => { assert.equal(id, 'cheerio-without-node-native'); return require('cheerio'); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../providers/sky-latino.js'), 'utf8'), context);
  const result = await context.module.exports.getStreams('123', 'tv', 2, 1);
  assert.equal(result.length, 0); // Confirm no false stream for a removed episode.
  assert.ok(calls.includes(episode));
});
