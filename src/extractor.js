'use strict';
const html = require('./html');
const URL = require('./url');
const { unpack } = require('./unpack');
const { UA } = require('./extractor-constants');

function createExtractor(config) {
  config = config || {};
  const fetcher = config.fetch || fetch;
  const base = config.base || html.BASE;
  const diagnostics = [];
  const deadline = Date.now() + (config.budgetMs || 22000);
  let requestCount = 0;
  function note(stage, url, status, detail) {
    diagnostics.push({ stage, host: url ? new URL(url).hostname : '', status, detail: detail || '' });
  }
  function request(url, referer, options) {
    options = options || {};
    url = html.safeURL(url, base);
    if (!url) return Promise.reject(new Error('unsafe_url'));
    if (Date.now() > deadline || ++requestCount > (config.maxRequests || 24))
      return Promise.reject(new Error('request_budget'));
    const headers = { 'User-Agent': UA, 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.5' };
    if (referer) headers.Referer = referer;
    if (options.range) headers.Range = 'bytes=0-1023';
    const init = { method: options.method || 'GET', headers, redirect: 'follow' };
    // No timers/AbortController assumptions in Nuvio's constrained runtime.
    // The host runtime must enforce its own per-request timeout.
    return Promise.resolve().then(() => fetcher(url, init)).then(function (r) {
      if (!r || r.status < 200 || r.status >= 300) throw new Error('http_' + (r && r.status));
      const resolved = html.safeURL(r.url || url, url);
      if (!resolved) throw new Error('unsafe_redirect');
      const header = function (name) {
        return r.headers && (typeof r.headers.get === 'function' ? r.headers.get(name) : r.headers[name]);
      };
      const type = String(header('content-type') || '').toLowerCase();
      if (options.headersOnly) {
        // A range probe in runtimes that expose a stream must not buffer the movie.
        if (r.body && typeof r.body.cancel === 'function') {
          const cancelled = r.body.cancel();
          if (cancelled && cancelled.catch) cancelled.catch(function () {});
        }
        return { url: resolved, type, status: r.status, body: '' };
      }
      if (/^video\//.test(type)) throw new Error('binary_as_text');
      const length = Number(header('content-length') || 0);
      if (length > 2000000) throw new Error('response_too_large');
      return r.text().then(function (body) {
        if (body.length > 2000000 || /\n\.\.\.\[truncated\]\s*$/.test(body)) throw new Error('response_too_large');
        return { url: resolved, type, status: r.status, body };
      });
    });
  }

  function probe(url, referer, allowedType) {
    // Native runtimes can strip Range and buffer the whole body. Never fall back
    // to a GET that might download a multi-GB film merely to inspect its headers.
    return request(url, referer, { method: 'HEAD', headersOnly: true }).then(function (response) {
      if (!allowedType.test(response.type)) throw new Error('not_media_mime');
      return response;
    });
  }

  function verify(url, referer) {
    if (/\.m3u8(?:$|\?)/i.test(url)) {
      return request(url, referer).then(function (master) {
        const parsed = html.parseHLS(master.body, master.url);
        const best = parsed.variants[0];
        const media = best ? request(best.url, referer) : Promise.resolve(master);
        return media.then(function (playlist) {
          const p = html.parseHLS(playlist.body, playlist.url);
          if (p.variants.length || !p.segment) throw new Error('missing_media_playlist');
          const checks = [probe(p.segment, referer, /^(?:video\/|audio\/|application\/(?:octet-stream|mp2t))/)];
          if (p.init) checks.push(probe(p.init, referer, /^(?:video\/|audio\/|application\/octet-stream)/));
          // Encrypted HLS without accessible key is not a valid candidate.
          if (p.key) checks.push(probe(p.key, referer, /^(?:application\/octet-stream|binary\/octet-stream)/));
          return Promise.all(checks).then(function () {
            // Prefer the highest verified rendition, avoiding an automatic
            // low-resolution start. Keep the master if audio/subtitle groups
            // are external, so selecting a variant cannot silently lose them.
            const adaptive = !!best && parsed.externalGroups;
            return { url: best && !adaptive ? playlist.url : master.url,
              quality: best && best.height ? best.height + 'p' : 'Calidad no verificada',
              width: best ? best.width : 0,
              height: best ? best.height : 0, adaptive, format: 'm3u8', referer };
          });
        });
      });
    }
    return probe(url, referer, /^video\/(?:mp4|x-m4v)/).then(function (response) {
      return { url: response.url, quality: 'Calidad no verificada', height: 0, adaptive: false, format: 'mp4', referer };
    });
  }

  function resolve(url, referer, visited, depth) {
    visited = visited || {};
    depth = depth || 0;
    if (depth > 5 || visited[url]) return Promise.resolve([]);
    visited[url] = true;
    // /e/.../filename.mp4 is frequently HTML, never assume the extension is proof.
    if (/\.(?:m3u8|mp4)(?:$|\?)/i.test(url) && !/\/(?:e|embed|d|file|download)\//i.test(new URL(url).pathname)) {
      return verify(url, referer).then(s => [s]).catch(function (error) {
        note('verify', url, error.message);
        return [];
      });
    }
    return request(url, referer).then(function (page) {
      if (page.url !== url) note('redirect', page.url, 'resolved');
      const reason = html.stopReason(page.body);
      if (reason) { note('resolve', page.url, reason); return []; }
      const expanded = unpack(page.body);
      if (expanded.length) note('unpack', page.url, 'static_dictionary', String(expanded.length));
      const direct = html.mediaLinks(page.body + '\n' + expanded.join('\n'), page.url);
      const nested = html.followLinks(page.body, page.url);
      if (!direct.length && !nested.length) note('resolve', page.url,
        /<script[^>]*\bsrc=|<div[^>]*id=["']root["']/i.test(page.body) ? 'dynamic_player_unsupported' : 'no_media');
      // Serial requests limit load and prevent one rejected host cancelling others.
      const tasks = direct.map(link => () => verify(link, page.url).then(s => [s]).catch(function (error) {
        note('verify', link, error.message); return [];
      })).concat(nested.map(link => () => resolve(link, page.url, visited, depth + 1)));
      return sequence(tasks).then(groups => [].concat.apply([], groups));
    }).catch(function (error) { note('resolve', url, error.message); return []; });
  }

  function sequence(tasks) {
    return tasks.reduce((chain, task) => chain.then(function (all) {
      if (Date.now() > deadline) { note('budget', '', 'deadline'); return all; }
      return task().then(value => all.concat([value]));
    }), Promise.resolve([]));
  }

  function inspect(pageURL) {
    if (new URL(pageURL).origin !== new URL(base).origin ||
        !/^\/(?:pelicula|episodio)\/[^/]+\/?$/.test(new URL(pageURL).pathname))
      return Promise.reject(new Error('invalid_movie_page'));
    return request(pageURL, base + '/').then(function (page) {
      const reason = html.stopReason(page.body);
      if (reason) throw new Error(reason);
      const parsed = html.playerOptions(page.body, page.url);
      note('options', page.url, 'found', String(parsed.options.length));
      return sequence(parsed.options.slice(0, 9).map(option => function () {
        return resolve(option.url, page.url, {}, 0).then(function (streams) {
          return streams.map(s => Object.assign({}, s, { language: option.language }));
        });
      })).then(function (groups) {
        const seen = {};
        const streams = [].concat.apply([], groups).filter(function (stream) {
          const key = stream.url + '\n' + stream.language + '\n' + stream.referer;
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        }).sort((a, b) => b.height - a.height);
        return { title: parsed.title, pageURL: page.url, options: parsed.options,
          streams: present(streams), diagnostics: diagnostics.slice() };
      });
    });
  }

  function present(streams) {
    return streams.map(function (stream, index) {
      const dimensions = stream.width && stream.height ? stream.width + '×' + stream.height : stream.quality;
      const quality = stream.adaptive && stream.height ? 'Hasta ' + dimensions : dimensions;
      return {
        name: 'sky latino',
        title: stream.language + ' · Opción ' + (index + 1) + ' · ' + quality,
        url: stream.url,
        quality: stream.quality,
        language: stream.language === 'Subtitulado' || stream.language === 'Idioma no indicado' ? 'und' : 'es',
        headers: { Referer: stream.referer, 'User-Agent': UA },
        subtitles: [],
        behaviorHints: { notWebReady: true, proxyHeaders: { request: { Referer: stream.referer, 'User-Agent': UA } } }
      };
    });
  }

  function search(details) {
    const titles = (details.titles || [details.title]).filter(Boolean);
    return sequence(titles.slice(0, 2).map(title => function () {
      const url = base + '/?s=' + encodeURIComponent(title);
      return request(url, base + '/').then(function (page) {
        const reason = html.stopReason(page.body);
        if (reason) throw new Error(reason);
        return html.searchResults(page.body, base, details.type);
      }).catch(function (error) { note('search', url, error.message); return []; });
    })).then(function (groups) {
      const ranked = html.rankResults([].concat.apply([], groups), details);
      const seen = {};
      return ranked.filter(function (item) {
        if (seen[item.url]) return false;
        seen[item.url] = true;
        return true;
      });
    });
  }

  function extract(details) {
    return search(details).then(function (matches) {
      if (!matches.length) return { streams: [], diagnostics: diagnostics.concat([{ stage: 'match', status: 'no_exact_match' }]) };
      if (details.type === 'series') {
        const { createSource } = require('./source');
        return createSource({ fetch: fetcher, base }).findEpisode(matches[0].url, details.season, details.episode)
          .then(inspect).catch(function (error) {
            return { streams: [], diagnostics: diagnostics.concat([{ stage: 'episode', status: error.message }]) };
          });
      }
      return inspect(matches[0].url);
    });
  }

  return { inspect, search, extract, resolve, verify, diagnostics };
}

module.exports = { createExtractor, UA };
