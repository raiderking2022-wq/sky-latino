'use strict';
require('./node-runtime');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createExtractor } = require('../src/extractor');
const { transport } = require('./live');

(async function () {
  const input = process.argv[2] || 'https://www2.pelisforte.se/pelicula/tron-ares-2025-1782086786';
  const extractor = createExtractor({ fetch: transport, budgetMs: 70000, maxRequests: 32 });
  const report = await extractor.inspect(input);
  if (!report.streams.length) throw new Error('no_verified_candidates');
  const candidate = report.streams[0];
  const headers = Object.entries(candidate.headers).map(([key, value]) => key + ': ' + value + '\r\n').join('');
  const common = ['-v', 'error', '-rw_timeout', '15000000', '-allowed_extensions', 'ALL',
    '-headers', headers, '-analyzeduration', '3000000', '-probesize', '1000000'];
  const probe = spawnSync('ffprobe', common.concat([
    '-show_entries', 'stream=index,codec_type,codec_name,width,height', '-of', 'json', candidate.url
  ]), { encoding: 'utf8', timeout: 45000, maxBuffer: 1000000 });
  let streams = [];
  if (probe.status === 0) streams = JSON.parse(probe.stdout).streams || [];
  const bestVideo = streams.filter(s => s.codec_type === 'video')
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const decode = probe.status === 0 && bestVideo ? spawnSync('ffmpeg', common.concat([
    '-i', candidate.url, '-t', '3', '-map', '0:' + bestVideo.index, '-map', '0:a:0?', '-f', 'null', '-'
  ]), { encoding: 'utf8', timeout: 45000, maxBuffer: 1000000 }) : null;
  const result = {
    checkedAt: new Date().toISOString(), input, title: report.title,
    testedOption: candidate.title, streams,
    decodedVideo: bestVideo || null,
    ffprobeSucceeded: probe.status === 0,
    threeSecondSampleDecoded: !!decode && decode.status === 0,
    nuvioPlaybackTested: false
  };
  // Do not log signed media URLs, headers or raw decoder messages containing tokens.
  if (probe.error) result.probeError = probe.error.code;
  if (decode && decode.error) result.decodeError = decode.error.code;
  const dir = path.join(__dirname, '../reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'decode-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
