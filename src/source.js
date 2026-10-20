'use strict';
const h = require('./html');
const c = require('./catalog-html');
const URL = require('./url');
const { UA } = require('./extractor-constants');

function createSource(options) {
  options = options || {};
  const base = options.base || h.BASE;
  const fetcher = options.fetch || fetch;
  const cache = options.cache || new Map();
  function get(url, init) {
    const key = url + (init && init.body || '');
    const existing = cache.get(key);
    if (existing && existing.expires > Date.now()) return Promise.resolve(existing.body);
    return Promise.resolve().then(() => fetcher(url, Object.assign({
      headers: { 'User-Agent': UA, Referer: base + '/' }
    }, init || {}))).then(function (response) {
      if (!response || response.status < 200 || response.status >= 300) throw new Error('source_unavailable');
      return response.text();
    }).then(function (body) {
      if (body.length > 2000000 || h.stopReason(body)) throw new Error('source_unavailable');
      cache.set(key, { body, expires: Date.now() + 120000 });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      return body;
    });
  }
  function pageURL(type, page, query) {
    if (query) return base + (page > 1 ? '/page/' + page + '/' : '/') + '?s=' + encodeURIComponent(query);
    if (type === 'series') return page === 1 ? base + '/series-1746289646' : null;
    return page === 1 ? base + '/portal003' : base + '/todas-las-peliculas/page/' + page;
  }
  function catalog(type, query, skip) {
    if (!['movie', 'series'].includes(type)) return Promise.reject(new Error('invalid_type'));
    const page = Math.floor((skip || 0) / 20) + 1;
    const url = pageURL(type, page, query);
    if (!url) return Promise.resolve([]);
    return get(url).then(body => c.cards(body, base, type).items.slice((skip || 0) % 20).map(item => item.meta));
  }
  function urlFor(parsed) {
    return base + (parsed.type === 'series' ? '/serie/' : '/pelicula/') + parsed.slug;
  }
  function metadata(id) {
    const parsed = c.parseID(id);
    if (!parsed || parsed.season !== null) return Promise.reject(new Error('invalid_id'));
    const url = urlFor(parsed);
    return get(url).then(function (body) {
      const result = c.detail(body, url, parsed.type);
      if (parsed.type !== 'series' || !result.ajax || !result.post || !result.ajax.nonce) return result.meta;
      const known = {};
      result.episodes.forEach(ep => { known[ep.season] = true; });
      const missing = result.seasons.filter(season => !known[season]).slice(0, 3);
      // Normal read-only site endpoint. Challenge/failed seasons remain absent;
      // no CAPTCHA resolution and no synthetic/unverified episode lists.
      return missing.reduce(function (chain, season) {
        return chain.then(function () {
          const endpoint = h.safeURL(result.ajax.url, base);
          if (!endpoint || new URL(endpoint).origin !== new URL(base).origin) return;
          return get(endpoint, {
            method: 'POST',
            headers: { 'User-Agent': UA, Referer: url, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=action_select_season&nonce=' + encodeURIComponent(result.ajax.nonce) + '&season=' + season + '&post=' + encodeURIComponent(result.post)
          }).then(function (fragment) {
            result.episodes = result.episodes.concat(c.episodeLinks(fragment, url, id));
          }).catch(function () {});
        });
      }, Promise.resolve()).then(function () {
        const seen = {};
        result.meta.videos = result.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode).filter(function (ep) {
          if (seen[ep.id]) return false; seen[ep.id] = true; return true;
        }).map(function (ep) { const video = Object.assign({}, ep); delete video.url; return video; });
        return result.meta;
      });
    });
  }
  function findEpisode(seriesURL, season, episode) {
    return get(seriesURL).then(function (body) {
      const result = c.detail(body, seriesURL, 'series');
      const found = result.episodes.find(ep => ep.season === season && ep.episode === episode);
      if (found) return found.url;
      const endpoint = result.ajax && h.safeURL(result.ajax.url, base);
      if (!result.seasons.includes(season) || !endpoint || new URL(endpoint).origin !== new URL(base).origin || !result.post)
        throw new Error('episode_unavailable');
      return get(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, Referer: seriesURL, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=action_select_season&nonce=' + encodeURIComponent(result.ajax.nonce || '') + '&season=' + season + '&post=' + encodeURIComponent(result.post)
      }).then(function (fragment) {
        const observed = c.episodeLinks(fragment, seriesURL, result.meta.id)
          .find(ep => ep.season === season && ep.episode === episode);
        if (!observed) throw new Error('episode_unavailable');
        return observed.url;
      }).catch(function () {
        throw new Error('episode_unavailable');
      });
    });
  }
  function playbackPage(id) {
    const parsed = c.parseID(id);
    if (!parsed) return Promise.reject(new Error('invalid_id'));
    if (parsed.type === 'movie') return Promise.resolve(urlFor(parsed));
    if (parsed.season === null || parsed.episode === null) return Promise.reject(new Error('episode_required'));
    return findEpisode(urlFor(parsed), parsed.season, parsed.episode);
  }
  return { catalog, metadata, playbackPage, findEpisode, get };
}
module.exports = { createSource };
