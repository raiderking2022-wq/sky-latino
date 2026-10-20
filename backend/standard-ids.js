'use strict';
function parseStandardID(value, type) {
  const m = /^(tt\d{5,12})(?::(\d{1,3}):(\d{1,4}))?$/.exec(value);
  if (!m || !['movie', 'series'].includes(type)) return null;
  if (type === 'movie' && m[2] || type === 'series' && (!m[2] || !m[3] || Number(m[2]) < 1 || Number(m[3]) < 1)) return null;
  return { imdb: m[1], type, season: m[2] ? Number(m[2]) : null, episode: m[3] ? Number(m[3]) : null };
}
function createStandardResolver(fetcher) {
  const cache = new Map();
  return async function resolve(parsed) {
    const key = parsed.type + ':' + parsed.imdb;
    let item = cache.get(key);
    if (!item || item.expires < Date.now()) {
      const url = 'https://v3-cinemeta.strem.io/meta/' + parsed.type + '/' + parsed.imdb + '.json';
      const response = await fetcher(url);
      if (!response || response.status !== 200) throw new Error('metadata_unavailable');
      let result;
      try { result = JSON.parse(await response.text()); } catch (_) { throw new Error('metadata_unavailable'); }
      if (!result.meta || typeof result.meta.name !== 'string' || !result.meta.name.trim() ||
          result.meta.name.length > 180 || (result.meta.id && result.meta.id !== parsed.imdb))
        throw new Error('metadata_unavailable');
      const year = String(result.meta.year || result.meta.releaseInfo || '').match(/\b(19\d{2}|20\d{2})\b/);
      item = { expires: Date.now() + 3600000, details: { titles: [result.meta.name], year: year ? Number(year[1]) : null } };
      cache.set(key, item);
      if (cache.size > 256) cache.delete(cache.keys().next().value);
    }
    return Object.assign({}, item.details, { type: parsed.type, season: parsed.season, episode: parsed.episode });
  };
}
module.exports = { parseStandardID, createStandardResolver };
