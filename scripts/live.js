'use strict';
require('./node-runtime');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createExtractor } = require('../src/extractor');

// cURL is used only by this sandbox diagnostic CLI. The plugin uses Nuvio fetch.
// Follow redirects with a fresh request, so Referer is not silently dropped.
function transport(url, init, redirectDepth) {
  redirectDepth = redirectDepth || 0;
  const marker = '\n__CINE_HTTP__';
  const args = ['--silent', '--show-error', '--max-time', '10', '--max-filesize', '2000000',
    '--dump-header', '-', '--write-out', marker + '%{http_code}\n%{url_effective}', url];
  if (init.method === 'HEAD' || init.headers.Range) args.unshift('--head');
  Object.entries(init.headers || {}).forEach(([key, value]) => args.unshift('-H', key + ': ' + value));
  const result = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 2500000 });
  if (result.error) return Promise.reject(result.error);
  const output = result.stdout || '';
  const cut = output.lastIndexOf(marker);
  if (cut < 0) return Promise.reject(new Error('transport_' + result.status));
  const status = Number(output.slice(cut + marker.length).split('\n')[0]);
  const responseURL = output.slice(cut + marker.length).split('\n')[1];
  let payload = output.slice(0, cut);
  const headers = {};
  while (/^HTTP\/[\d.]+ \d+/.test(payload)) {
    const delimiter = payload.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const end = payload.indexOf(delimiter);
    if (end < 0) break;
    payload.slice(0, end).split(/\r?\n/).slice(1).forEach(function (line) {
      const colon = line.indexOf(':');
      if (colon > 0) headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
    });
    payload = payload.slice(end + delimiter.length);
  }
  if (status >= 300 && status < 400 && headers.location && redirectDepth < 6) {
    const next = new URL(headers.location, url).href;
    const { safeURL } = require('../src/html');
    if (!safeURL(next)) return Promise.reject(new Error('unsafe_redirect'));
    return transport(next, init, redirectDepth + 1);
  }
  if (result.status && status === 200 && !headers['content-type']) return Promise.reject(new Error('transport_' + result.status));
  return Promise.resolve({
    status, ok: status >= 200 && status < 300, url: responseURL,
    headers: { get: name => headers[name.toLowerCase()] || null },
    text: () => Promise.resolve(payload)
  });
}

module.exports = { transport };
if (require.main === module) {
const samples = process.argv.slice(2);
if (!samples.length) samples.push(
  'https://www2.pelisforte.se/pelicula/ex-machina-2015-1691653451',
  'https://www2.pelisforte.se/pelicula/tron-ares-2025-1782086786'
);
(async function () {
  const reports = [];
  for (const url of samples) {
    try {
      const extractor = createExtractor({ fetch: transport, budgetMs: 70000, maxRequests: 32 });
      const report = /^https:/.test(url)
        ? await extractor.inspect(url)
        : await extractor.extract({ titles: [url] });
      // Public diagnostics exclude expiring tokens and URL query parameters.
      const summary = {
        input: url,
        title: report.title,
        options: report.options ? report.options.map(o => ({ language: o.language, host: new URL(o.url).hostname })) : [],
        verifiedCandidates: report.streams.length,
        streams: report.streams.map(s => ({ name: s.name, title: s.title, quality: s.quality, host: new URL(s.url).hostname })),
        diagnostics: report.diagnostics,
        nuvioPlaybackTested: false
      };
      reports.push(summary);
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      const report = { input: url, error: error.message, verifiedCandidates: 0, nuvioPlaybackTested: false };
      reports.push(report);
      console.log(JSON.stringify(report, null, 2));
    }
  }
  const dir = path.join(__dirname, '../reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'live-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
})();
}
