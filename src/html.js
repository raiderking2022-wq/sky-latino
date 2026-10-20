'use strict';
const cheerio = require('cheerio-without-node-native');
const URL = require('./url');

const BASE = 'https://www2.pelisforte.se';

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeURL(value, base) {
  const input = String(value || '').trim().replace(/&amp;/g, '&').replace(/\\\//g, '/');
  if (!input) return null;
  try {
    const u = new URL(input, base);
    const host = u.hostname.toLowerCase();
    // No credentials, local addresses or arbitrary ports from untrusted HTML.
    if (!/^https?:$/.test(u.protocol) || u.username || u.password ||
        (u.port && u.port !== '80' && u.port !== '443') ||
        !host.includes('.') || /[:\[\]]/.test(host) || host.endsWith('.') ||
        /^(?:0x[\da-f]+|\d+)(?:\.(?:0x[\da-f]+|\d+)){0,3}$/i.test(host) ||
        /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    return u.href;
  } catch (_) { return null; }
}

function normalize(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function searchResults(html, base, mediaType) {
  const $ = cheerio.load(html);
  const seen = {};
  const results = [];
  $('article').each(function (_, article) {
    const item = $(article);
    const anchors = item.find('h2 a, h3 a, .entry-title a, a');
    let url = null;
    anchors.each(function (_, anchor) {
      const candidate = safeURL($(anchor).attr('href'), base);
      const pattern = mediaType === 'series' ? /^\/serie\/[^/]+\/?$/ : /^\/pelicula\/[^/]+\/?$/;
      if (!url && candidate && new URL(candidate).origin === new URL(base).origin &&
          pattern.test(new URL(candidate).pathname)) url = candidate;
    });
    if (!url || seen[url]) return;
    seen[url] = true;
    const title = text(item.find('h2, h3, .entry-title').first().text()) ||
      text(item.find('img').first().attr('alt')).replace(/^Image\s+/i, '');
    const yearMatch = text(item.text()).match(/\b(19\d{2}|20\d{2})\b/);
    results.push({ url, title, year: yearMatch ? Number(yearMatch[1]) : null });
  });
  return results;
}

function rankResults(results, details) {
  const titles = (details.titles || [details.title]).map(normalize).filter(Boolean);
  return results.map(function (result) {
    const candidateTitles = [result.title].concat(result.aliases || []).map(normalize).filter(Boolean);
    let score = -1;
    titles.forEach(function (wanted) {
      candidateTitles.forEach(function (title) {
        if ((wanted.match(/\b\d+\b/g) || []).join(',') !== (title.match(/\b\d+\b/g) || []).join(',')) return;
        const words = wanted.split(' ');
        const overlap = words.filter(w => title.split(' ').includes(w)).length / words.length;
        const candidate = title === wanted ? 100 : overlap >= 0.8 ? 70 + overlap : -1;
        score = Math.max(score, candidate);
      });
    });
    if (details.year && result.year) {
      if (Math.abs(details.year - result.year) > 1) score = -1;
      else if (details.year === result.year) score += score >= 0 ? 10 : 0;
    }
    return Object.assign({}, result, { score });
  }).filter(r => r.score >= 70).sort((a, b) => b.score - a.score);
}

function alternativeTitles(markup) {
  const $ = cheerio.load(markup);
  const aliases = [];
  $('p').each(function (_, element) {
    const caption = normalize($(element).text());
    if (!/tambien conocid[ao].*titulos|titulos alternativos|titulo original/.test(caption)) return;
    const paragraph = $(element).next('p');
    const raw = paragraph.html() || '';
    raw.split(/<br\s*\/?>/i).forEach(function (part) {
      const value = text(cheerio.load('<p>' + part + '</p>')('p').text()).replace(/[.\s]+$/, '');
      if (value.length >= 2 && value.length <= 160 && !aliases.includes(value)) aliases.push(value);
    });
  });
  return aliases.slice(0, 12);
}

function language(value) {
  if (/latino/i.test(value)) return 'Latino';
  if (/castellano|españa/i.test(value)) return 'Castellano';
  if (/subtitul/i.test(value)) return 'Subtitulado';
  return 'Idioma no indicado';
}

function playerOptions(html, base) {
  const $ = cheerio.load(html);
  const options = [];
  const seen = {};
  $('[id^="options-"]').each(function (_, element) {
    const item = $(element);
    const id = item.attr('id');
    const frame = item.find('iframe').first();
    const url = safeURL(frame.attr('data-src') || frame.attr('src'), base);
    if (!url || seen[url]) return;
    seen[url] = true;
    let label = '';
    // No dynamic selector interpolation from untrusted id attributes.
    $('a').each(function (_, a) {
      if ($(a).attr('href') === '#' + id) label = text($(a).text());
    });
    options.push({
      id,
      url,
      language: language(label),
      // Internal diagnostics only. Never copy to visible Nuvio fields.
      sourceLabel: label
    });
  });
  return { title: text($('h1').first().text()), options };
}

function stopReason(html) {
  if (/Video\s+Removed|file\s+(?:was\s+)?(?:deleted|not\s+found)|video\s+(?:has\s+been\s+)?removed/i.test(html))
    return 'removed';
  if (/cf-chl-|challenges\.cloudflare\.com|verify you(?:'|’)?re a human|verify you are human|Performing security verification/i.test(html))
    return 'challenge';
  if (/Video source is unavailable/i.test(html)) return 'unavailable';
  if (/Video embed restricted for this domain/i.test(html)) return 'referer_restricted';
  return null;
}

function followLinks(html, base) {
  const $ = cheerio.load(html);
  const urls = [];
  const push = value => {
    const url = safeURL(value, base);
    if (url && !urls.includes(url)) urls.push(url);
  };
  $('iframe').each(function (_, frame) {
    push($(frame).attr('data-src') || $(frame).attr('src'));
  });
  // Accept only literal navigation targets, never execute downloaded JS.
  const re = /(?:window\.)?location\.(?:replace|assign)\(\s*(["'])([^"'\\]+)\1\s*\)|(?:window\.)?location(?:\.href)?\s*=\s*(["'])([^"'\\]+)\3/g;
  let match;
  while ((match = re.exec(html))) push(match[2] || match[4]);
  $('meta[http-equiv]').each(function (_, element) {
    if (String($(element).attr('http-equiv')).toLowerCase() !== 'refresh') return;
    const m = /url\s*=\s*["']?([^"']+)$/i.exec($(element).attr('content') || '');
    if (m) push(m[1].trim());
  });
  return urls.slice(0, 4);
}

function mediaLinks(html, base) {
  const $ = cheerio.load(html);
  const values = [];
  $('source, video').each(function (_, element) {
    const src = $(element).attr('src');
    if (src) values.push(src);
  });
  // Public literal player configuration only: no eval, no bundle execution.
  const re = /(?:["']?(?:file|hls|mp4|src)["']?)\s*:\s*(["'])((?:\\.|(?!\1).)+)\1/g;
  let match;
  while ((match = re.exec(html))) values.push(match[2]);
  return values.map(v => safeURL(v, base)).filter(function (url, index, all) {
    return url && /\.(?:m3u8|mp4)(?:$|\?)/i.test(url) && all.indexOf(url) === index;
  }).slice(0, 8);
}

function parseHLS(body, base) {
  const lines = String(body || '').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines[0] !== '#EXTM3U') throw new Error('invalid_hls');
  // DRM is not handled by this extractor.
  if (/#EXT-X-SESSION-KEY|KEYFORMAT\s*=|METHOD=(?!NONE|AES-128)[A-Z0-9-]+/i.test(body)) throw new Error('drm_unsupported');
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^#EXT-X-STREAM-INF:/.test(lines[i])) continue;
    const resolution = /RESOLUTION=(\d+)x(\d+)/i.exec(lines[i]);
    const width = resolution ? Number(resolution[1]) : 0;
    const height = resolution ? Number(resolution[2]) : 0;
    const bandwidth = Number((/(?:[:,])BANDWIDTH=(\d+)/.exec(lines[i]) || [])[1] || 0);
    let j = i + 1;
    while (j < lines.length && (!lines[j].trim() || /^#/.test(lines[j]))) j++;
    const url = safeURL(lines[j], base);
    if (url) variants.push({ url, width, height, bandwidth });
  }
  const segmentLine = lines.find(line => line.trim() && !/^#/.test(line));
  const init = /#EXT-X-MAP:.*?URI="([^"]+)"/.exec(body);
  const key = /#EXT-X-KEY:.*?METHOD=AES-128.*?URI="([^"]+)"/.exec(body);
  return {
    variants: variants.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth),
    externalGroups: /#EXT-X-MEDIA:[^\r\n]*(?:TYPE=AUDIO|TYPE=SUBTITLES)[^\r\n]*URI=/i.test(body),
    segment: segmentLine ? safeURL(segmentLine.trim(), base) : null,
    init: init ? safeURL(init[1], base) : null,
    key: key ? safeURL(key[1], base) : null
  };
}

module.exports = {
  BASE, text, safeURL, normalize, searchResults, rankResults, playerOptions,
  stopReason, followLinks, mediaLinks, parseHLS, alternativeTitles
};
