'use strict';
require('./scripts/node-runtime');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createSource } = require('./src/source');
const { createExtractor } = require('./src/extractor');
const { parseID } = require('./src/catalog-html');
const { publicFetch } = require('./backend/fetch');
const addonManifest = require('./addon/manifest.json');
const pluginManifest = require('./manifest.json');

function createHandler(options) {
  options = options || {};
  const fetcher = options.fetch || publicFetch;
  const source = options.source || createSource({ fetch: fetcher });
  const cache = new Map();
  const pending = new Map();
  const visitors = new Map();
  function cached(key, ttl, task) {
    const item = cache.get(key);
    if (item && item.expires > Date.now()) return Promise.resolve(item.value);
    if (pending.has(key)) return pending.get(key);
    const result = Promise.resolve().then(task).then(function (value) {
      cache.set(key, { value, expires: Date.now() + ttl });
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  }
  function json(res, code, value, ttl) {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': code === 200 ? 'public, max-age=' + (ttl || 0) : 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(value));
  }
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'method_not_allowed' });
    let pathname;
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
      pathname = url.pathname;
      // Validate escapes without decoding the entire extras path. Doing so
      // would turn an encoded ampersand inside a title into a separator.
      decodeURIComponent(pathname);
    } catch (_) { return json(res, 400, { error: 'invalid_path' }); }
    if (pathname === '/health') return json(res, 200, { name: 'sky latino', version: addonManifest.version, status: 'ok' });
    if (pathname === '/addon/manifest.json') return json(res, 200, addonManifest, 60);
    if (pathname === '/plugin/manifest.json') return json(res, 200, pluginManifest, 60);
    if (pathname === '/plugin/providers/sky-latino.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' });
      return fs.createReadStream(path.join(__dirname, 'providers/sky-latino.js')).pipe(res);
    }
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.createReadStream(path.join(__dirname, 'public/index.html')).pipe(res);
    }
    if (pathname === '/base.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
      return fs.createReadStream(path.join(__dirname, 'public/base.css')).pipe(res);
    }
    // Read-only public service: short-lived, bounded, in-memory rate limiting.
    const visitor = String(req.headers['x-visitor-id'] || req.socket && req.socket.remoteAddress || 'unknown');
    const previous = visitors.get(visitor);
    const bucket = previous && previous.expires > Date.now() ? previous : { count: 0, expires: Date.now() + 60000 };
    visitors.set(visitor, bucket);
    if (visitors.size > 2000) visitors.delete(visitors.keys().next().value);
    if (++bucket.count > 90) return json(res, 429, { error: 'try_again_later' });

    try {
      const catalog = /^\/addon\/catalog\/(movie|series)\/(sky-movies|sky-series)(?:\/(.+))?\.json$/.exec(pathname);
      if (catalog) {
        const type = catalog[1];
        if ((type === 'movie' ? 'sky-movies' : 'sky-series') !== catalog[2]) return json(res, 404, { metas: [] });
        const extra = catalog[3] || url.search.slice(1);
        const params = new URLSearchParams(extra.includes('=') ? extra : decodeURIComponent(extra));
        const query = (params.get('search') || '').trim();
        const rawSkip = params.get('skip') || '0';
        if (query.length > 120 || !/^\d+$/.test(rawSkip) || Number(rawSkip) > 10000)
          return json(res, 400, { metas: [], error: 'invalid_search' });
        const skip = Number(rawSkip);
        const result = await cached('catalog:' + type + ':' + query + ':' + skip, 120000,
          async () => ({ metas: await source.catalog(type, query, skip) }));
        return json(res, 200, result, 60);
      }
      const metadata = /^\/addon\/meta\/(movie|series)\/([^/]+)\.json$/.exec(pathname);
      if (metadata) {
        metadata[2] = decodeURIComponent(metadata[2]);
        const parsed = parseID(metadata[2]);
        if (!parsed || parsed.type !== metadata[1] || parsed.season !== null) return json(res, 404, { meta: null });
        const result = await cached('meta:' + metadata[2], 300000,
          async () => ({ meta: await source.metadata(metadata[2]) }));
        return json(res, 200, result, 120);
      }
      const stream = /^\/addon\/stream\/(movie|series)\/([^/]+)\.json$/.exec(pathname);
      if (stream) {
        stream[2] = decodeURIComponent(stream[2]);
        const parsed = parseID(stream[2]);
        if (!parsed || parsed.type !== stream[1]) return json(res, 404, { streams: [] });
        const result = await cached('stream:' + stream[2], 45000, async () => {
          const page = await source.playbackPage(stream[2]);
          const report = await createExtractor({ fetch: fetcher, budgetMs: 35000, maxRequests: 48 }).inspect(page);
          return { streams: report.streams };
        });
        return json(res, 200, result, 15);
      }
      return json(res, 404, { error: 'not_found' });
    } catch (_) {
      // No origin names, signed URLs or internal stack traces in responses.
      if (/\/stream\//.test(pathname)) return json(res, 200, { streams: [] });
      return json(res, 503, { error: 'source_temporarily_unavailable' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
if (require.main === module) {
  const port = Number(process.env.PORT || 5100);
  http.createServer(module.exports).listen(port, '0.0.0.0', () => console.log('sky latino API listening on ' + port));
}
