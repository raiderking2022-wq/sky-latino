'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomBytes } = require('node:crypto');
const run = promisify(execFile);
const { safeURL } = require('../src/html');
const { resolvePublicAddress } = require('./network-policy');

function parseResponse(output, marker) {
  const cut = output.lastIndexOf(marker);
  if (cut < 0) throw new Error('transport_failed');
  const tail = output.slice(cut + marker.length).split('\n');
  const status = Number(tail[0]);
  const url = tail[1];
  let payload = output.slice(0, cut);
  let headers = {};
  // HTTP proxy CONNECT headers and informational responses may precede the
  // actual response. Only the last complete header block is authoritative.
  while (/^HTTP\/[\d.]+ \d+/.test(payload)) {
    const delimiter = payload.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const end = payload.indexOf(delimiter);
    if (end < 0) throw new Error('transport_headers');
    headers = {};
    payload.slice(0, end).split(/\r?\n/).slice(1).forEach(function (line) {
      const colon = line.indexOf(':');
      if (colon > 0) headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
    });
    payload = payload.slice(end + delimiter.length);
  }
  return { status, url, payload, headers };
}

async function publicFetch(url, init, depth) {
  init = init || {};
  depth = depth || 0;
  url = safeURL(url);
  if (!url) throw new Error('unsafe_url');
  const destination = new URL(url);
  const address = await resolvePublicAddress(destination.hostname);
  const port = destination.port || (destination.protocol === 'https:' ? '443' : '80');
  const marker = '\n__SKY_' + randomBytes(8).toString('hex') + '__';
  // Ignore curl configuration/proxies and pin the validated DNS answer for this
  // connection. TLS still verifies the original hostname. Every redirect repeats
  // URL validation, DNS validation and pinning, preventing DNS rebinding.
  const args = ['--disable', '--proxy', '', '--noproxy', '*', '--ipv4',
    '--proto', '=http,https', '--resolve', destination.hostname + ':' + port + ':' + address,
    '--silent', '--show-error', '--max-time', '8', '--dump-header', '-',
    '--write-out', marker + '%{http_code}\n%{url_effective}'];
  if (init.method === 'HEAD') args.push('--head');
  else args.push('--max-filesize', '2000000');
  if (init.method && !['GET', 'HEAD'].includes(init.method)) args.push('--request', init.method);
  Object.entries(init.headers || {}).forEach(([key, value]) => args.push('--header', key + ': ' + value));
  if (init.body) args.push('--data-raw', String(init.body));
  args.push('--url', url);
  // Plain cURL HTTP requests, no browser automation or challenge bypass.
  let stdout;
  try {
    ({ stdout } = await run('curl', args, { encoding: 'utf8', timeout: 10000, maxBuffer: 2500000 }));
  } catch (error) {
    // execFile errors contain the entire command, including signed URLs.
    // Never propagate that string into diagnostics or API responses.
    throw new Error(error.code === 'ENOENT' ? 'transport_missing' : 'transport_unavailable');
  }
  const parsed = parseResponse(stdout, marker);
  if (parsed.status >= 300 && parsed.status < 400 && parsed.headers.location) {
    if (depth > 5) throw new Error('redirect_limit');
    const next = safeURL(parsed.headers.location, url);
    if (!next) throw new Error('unsafe_redirect');
    return publicFetch(next, init, depth + 1);
  }
  return {
    status: parsed.status, ok: parsed.status >= 200 && parsed.status < 300, url: parsed.url,
    headers: { get: name => parsed.headers[String(name).toLowerCase()] || null },
    text: () => Promise.resolve(parsed.payload)
  };
}
module.exports = { publicFetch, parseResponse };
