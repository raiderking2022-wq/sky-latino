'use strict';
require('../scripts/node-runtime');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { safeURL } = require('../src/html');
const { isPublicIPv4, resolvePublicAddress } = require('../backend/network-policy');
const { createHandler } = require('../server');

test('bloquea variantes con punto final y direcciones internas', () => {
  for (const host of ['127.0.0.1.', 'localhost.', '169.254.169.254.', 'metadata.google.internal.'])
    assert.equal(safeURL('http://' + host + '/'), null);
  for (const ip of ['0.0.0.0', '10.1.1.1', '100.64.0.1', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '192.168.0.1', '192.0.0.1',
    '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1',
    '255.255.255.255', '::1', '::ffff:127.0.0.1'])
    assert.equal(isPublicIPv4(ip), false, ip);
  assert.equal(isPublicIPv4('104.21.28.96'), true);
  assert.equal(isPublicIPv4('172.67.145.81'), true);
});

test('DNS rechaza respuestas privadas, mixtas o IPv6 antes de conectar', async () => {
  for (const records of [
    [{ address: '127.0.0.1', family: 4 }],
    [{ address: '104.21.28.96', family: 4 }, { address: '10.0.0.1', family: 4 }],
    [{ address: '::1', family: 6 }], []
  ]) await assert.rejects(resolvePublicAddress('host.example.com', async () => records), /unsafe_address/);
  assert.equal(await resolvePublicAddress('host.example.com',
    async () => [{ address: '104.21.28.96', family: 4 }]), '104.21.28.96');
});

async function withServer(handler, task) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await task('http://127.0.0.1:' + server.address().port); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('rotar cabeceras de visitante no evita el límite de solicitudes', async () => {
  await withServer(createHandler(), async base => {
    let limited = 0;
    for (let i = 0; i < 92; i++) {
      const response = await fetch(base + '/addon/stream/movie/invalid.json', {
        headers: { 'x-visitor-id': 'rotating-' + i, 'x-forwarded-for': '8.8.8.' + i }
      });
      if (response.status === 429) limited++;
      else assert.equal(response.status, 404);
      await response.text();
    }
    assert.equal(limited, 2);
  });
});

test('limita tareas distintas y libera plazas al completar', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const source = { catalog: async () => { calls++; await gate; return []; } };
  await withServer(createHandler({ source }), async base => {
    const pending = [0, 1, 2, 3].map(i =>
      fetch(base + '/addon/catalog/movie/sky-movies/search=item' + i + '.json'));
    try {
      for (let i = 0; calls < 4 && i < 100; i++)
        await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(calls, 4);
      const overloaded = await fetch(base + '/addon/catalog/movie/sky-movies/search=fifth.json');
      assert.equal(overloaded.status, 503);
      assert.equal(calls, 4);
    } finally { release(); }
    assert.ok((await Promise.all(pending)).every(response => response.status === 200));
    const next = await fetch(base + '/addon/catalog/movie/sky-movies/search=next.json');
    assert.equal(next.status, 200);
    assert.equal(calls, 5);
  });
});
