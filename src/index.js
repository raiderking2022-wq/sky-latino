'use strict';
const { createExtractor } = require('./extractor');

function getStreams(tmdbId, mediaType, season, episode) {
  if (!['movie', 'tv', 'series'].includes(mediaType) || !/^\d+$/.test(String(tmdbId))) return Promise.resolve([]);
  const isSeries = mediaType !== 'movie';
  if (isSeries && (!Number.isInteger(Number(season)) || !Number.isInteger(Number(episode)) ||
      Number(season) < 1 || Number(episode) < 1)) return Promise.resolve([]);
  const key = typeof globalThis !== 'undefined' && globalThis.TMDB_API_KEY;
  // Use the application's own metadata key when exposed by its runtime.
  // Never bundle somebody else's API credentials.
  if (!key) return Promise.resolve([]);
  const id = encodeURIComponent(String(tmdbId));
  const url = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv/' : 'movie/') + id + '?language=es-MX&api_key=' + encodeURIComponent(key) + '&append_to_response=alternative_titles';
  return Promise.resolve().then(() => fetch(url)).then(function (response) {
    if (!response.ok) throw new Error('metadata_unavailable');
    return response.json();
  }).then(function (meta) {
    if (!meta || (!meta.title && !meta.original_title && !meta.name)) return [];
    const alternate = meta.alternative_titles && (meta.alternative_titles.titles || meta.alternative_titles.results) || [];
    const aliases = alternate.filter(item => ['MX','ES','AR','US','GB'].includes(item.iso_3166_1)).map(item => item.title);
    return createExtractor().extract({
      titles: [meta.title || meta.name, meta.original_title || meta.original_name].concat(aliases).filter(Boolean),
      year: Number(String(meta.release_date || meta.first_air_date || '').slice(0, 4)) || null,
      type: isSeries ? 'series' : 'movie',
      season: Number(season), episode: Number(episode)
    }).then(report => report.streams);
  }).catch(function () { return []; });
}

module.exports = { getStreams };
